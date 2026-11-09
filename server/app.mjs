import express from 'express';
import session from 'express-session';
import fileStoreFactory from 'session-file-store';
import helmet from 'helmet';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readConfig } from './config/env.mjs';
import { requestGuard, safeErrorHandler } from './middleware/security.mjs';
import { installAuth } from './routes/auth.mjs';
import { createDemoWorkbook } from './services/demo.mjs';
import { createSyncService } from './services/sync.mjs';
import { rateLimit } from 'express-rate-limit';
import { staticDashboard } from './middleware/static.mjs';
import { assertPrivatePaths, validateServiceAccount } from './config/private.mjs';
import { createRevocableStore } from './services/revocable-session-store.mjs';
import { createSupabase, SupabaseSessionStore, SupabaseRateLimitStore } from './services/supabase.mjs';

const FileStore = fileStoreFactory(session);

export async function createApp(options = {}) {
  const config = options.config || readConfig(options.env || process.env);
  const cloud = config.storageBackend === 'supabase' ? createSupabase(config, { fetchImpl: options.supabaseFetch }) : null;
  const authOptions = cloud ? { ...options, accountRepository: cloud.repository,
    rateStore: prefix => new SupabaseRateLimitStore(cloud, prefix) } : options;
  await assertPrivatePaths(config.root, [!cloud && config.usersFile, config.serviceAccountFile, options.cacheDir || config.cacheDir, !cloud && config.sessionDir]);
  const serviceAccountCredentials = config.mode === 'sheets' && !options.workbookLoader
    ? await validateServiceAccount(config.serviceAccountFile, { json: config.serviceAccountJson }) : undefined;
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 'loopback');
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null } },
    frameguard: { action: 'deny' },
    strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false,
  }));
  app.use(requestGuard(config));
  app.use('/api', express.json({ limit: '16kb', strict: true }));
  const sessionNamespace = createHash('sha256').update(`${config.mode}:${config.spreadsheetId}:${config.sessionSecret}`).digest('hex').slice(0, 24);
  let store = options.sessionStore;
  if (!store && cloud) store = new SupabaseSessionStore(cloud, { namespace: sessionNamespace, ttlMs: config.sessionMaxAgeMs });
  if (!store) {
    const sessionPath = path.join(config.sessionDir, sessionNamespace);
    await mkdir(sessionPath, { recursive: true, mode: 0o700 });
    store = new FileStore({ path: sessionPath, ttl: config.sessionMaxAgeMs / 1000, retries: 0, reapInterval: -1, logFn: () => {} });
  }
  store = createRevocableStore(session.Store, store, { revocationTtlMs: config.sessionMaxAgeMs });
  const cookieName = config.nodeEnv === 'production' ? '__Host-marketing.sid' : 'marketing.sid';
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(session({
    name: cookieName, secret: config.sessionSecret, store,
    // Only the Vercel runtime may trust its HTTPS forwarding header for cookies.
    proxy: config.isVercel ? true : undefined,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'strict', secure: config.nodeEnv === 'production', maxAge: config.sessionMaxAgeMs, path: '/' },
  }));
  app.use((req, res, next) => {
    const release = store.trackRequest(req.sessionID);
    res.once('finish', release);
    res.once('close', release);
    next();
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  const requireAuth = await installAuth(app, { config, options: authOptions, cookieName });
  let workbookLoader = options.workbookLoader;
  if (!workbookLoader && config.mode === 'demo') workbookLoader = () => createDemoWorkbook(options.now?.() || new Date());
  if (!workbookLoader && config.mode === 'sheets') {
    const { createGoogleSheetsLoader } = await import('./services/google-sheets/loader.mjs');
    workbookLoader = createGoogleSheetsLoader(config, { credentials: serviceAccountCredentials });
  }
  const sync = await createSyncService({ mode: config.mode, spreadsheetId: config.spreadsheetId, cacheDir: options.cacheDir || config.cacheDir, workbookLoader, normalizer: options.normalizer, now: options.now, intervalMs: config.syncIntervalMs });
  const refresh = async (req, res) => {
    if (options.autoSync !== false && !config.isVercel) sync.start();
    const result = await sync.sync();
    res.status(result.data ? 200 : 503).json(result);
  };
  app.get('/api/data', requireAuth, async (req, res) => {
    if (options.autoSync !== false && !config.isVercel) sync.start();
    let result = sync.snapshot();
    const attempted = result.status.lastAttemptAt && Date.parse(result.status.lastAttemptAt);
    const current = options.now?.().getTime() ?? Date.now();
    const stale = !result.status.lastSuccessAt || current - Date.parse(result.status.lastSuccessAt) >= config.syncIntervalMs;
    if ((!result.data || (config.isVercel && stale)) && (sync.isSyncing() || !attempted || current - attempted >= 10000)) result = await sync.sync();
    res.status(result.data ? 200 : 503).json(result);
  });
  app.post('/api/sync', requireAuth, rateLimit({ ...(cloud ? { store: new SupabaseRateLimitStore(cloud, 'sync'), keyGenerator: req => req.user.id } : {}), windowMs: options.limits?.syncWindowMs || config.syncWindowMs, limit: options.limits?.syncMax || config.syncMax, standardHeaders: 'draft-8', legacyHeaders: false, validate: { xForwardedForHeader: false }, message: { error: 'Terlalu sering memperbarui data. Coba lagi sebentar.' } }), refresh);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
  app.use(staticDashboard(options.distDir || config.distDir));
  app.use(safeErrorHandler);
  app.locals.config = config;
  app.locals.sync = sync;
  app.locals.close = async () => { await sync.stop(); store.close(); };
  return app;
}
