import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const isLoopback = (host) => ['127.0.0.1', 'localhost', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);

function positiveInt(value, fallback, name, maximum = 65535) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error(`${name} is invalid.`);
  return number;
}

export function readConfig(env = process.env, root = ROOT) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (nodeEnv === 'production' && !env.DATA_MODE) throw new Error('DATA_MODE must be explicitly configured in production.');
  const mode = env.DATA_MODE || 'demo';
  const storageBackend = env.STORAGE_BACKEND || 'file';
  if (!['file', 'supabase'].includes(storageBackend)) throw new Error('STORAGE_BACKEND must be file or supabase.');
  const isVercel = env.VERCEL === '1';
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  let supabaseUrl = '';
  if (storageBackend === 'supabase') {
    try {
      const url = new URL(env.SUPABASE_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
      supabaseUrl = url.origin;
    } catch { throw new Error('SUPABASE_URL must be an HTTPS project origin.'); }
    if (!supabaseKey) throw new Error('SUPABASE_SECRET_KEY is required on the server.');
  }
  if (isVercel && storageBackend !== 'supabase') throw new Error('Vercel requires STORAGE_BACKEND=supabase.');
  if (!['demo', 'sheets'].includes(mode)) throw new Error('DATA_MODE must be demo or sheets.');
  const host = env.HOST || '127.0.0.1';
  if (mode === 'demo' && nodeEnv === 'production') throw new Error('Demo is disabled in production.');
  if (mode === 'demo' && !isLoopback(host)) throw new Error('Demo requires a loopback HOST.');
  const port = positiveInt(env.PORT, 3001, 'PORT');
  const sessionSecret = env.SESSION_SECRET || (mode === 'demo' ? randomBytes(48).toString('hex') : '');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID || '';
  const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const serviceAccountFile = !serviceAccountJson && env.GOOGLE_SERVICE_ACCOUNT_FILE ? path.resolve(root, env.GOOGLE_SERVICE_ACCOUNT_FILE) : '';
  const usersFile = path.resolve(root, env.USERS_FILE || 'server/config/users.json');
  if (mode === 'sheets') {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId)) throw new Error('GOOGLE_SPREADSHEET_ID is required and must be a valid ID.');
    if (!serviceAccountJson && !serviceAccountFile) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is required.');
  }
  let appOrigin = env.APP_ORIGIN || `http://${host.includes(':') ? `[${host.replace(/[\[\]]/g, '')}]` : host}:${port}`;
  let origin;
  try { origin = new URL(appOrigin); } catch { throw new Error('APP_ORIGIN is invalid.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path.');
  }
  appOrigin = origin.origin;
  if (nodeEnv === 'production' && origin.protocol !== 'https:') throw new Error('Production APP_ORIGIN requires HTTPS.');
  if (mode === 'demo' && !isLoopback(origin.hostname)) throw new Error('Demo APP_ORIGIN requires loopback.');
  const allowedOrigins = new Set([appOrigin]);
  if (nodeEnv !== 'production' && isLoopback(host)) {
    for (const local of ['127.0.0.1', 'localhost']) {
      allowedOrigins.add(`http://${local}:${port}`);
      allowedOrigins.add(`http://${local}:5173`);
    }
  }
  const cacheDir = isVercel ? path.join(tmpdir(), 'marketing-cache') : path.resolve(root, env.CACHE_DIR || 'server/private/cache');
  const sessionDir = path.resolve(root, env.SESSION_DIR || 'server/private/sessions');
  const privatePaths = [storageBackend === 'file' && usersFile, serviceAccountFile, cacheDir, storageBackend === 'file' && sessionDir].filter(Boolean);
  for (const file of privatePaths) {
    for (const publicFolder of ['public', 'dist', 'src']) {
      const relative = path.relative(path.resolve(root, publicFolder), file);
      if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('Credential and user files must be outside public, dist and src.');
      }
    }
  }
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'loopback') throw new Error('TRUST_PROXY only supports loopback.');
  return Object.freeze({
    root, nodeEnv, mode, host, port, sessionSecret, spreadsheetId, serviceAccountFile, serviceAccountJson, usersFile,
    storageBackend, supabaseUrl, supabaseKey, isVercel,
    appOrigin, allowedOrigins: [...allowedOrigins], allowedHosts: [...new Set([...allowedOrigins].map((entry) => new URL(entry).host))],
    trustProxy: env.TRUST_PROXY === 'loopback',
    cacheDir, sessionDir,
    distDir: path.resolve(root, 'dist'), syncIntervalMs: 300000,
    loginWindowMs: 900000, loginMax: 10, syncWindowMs: 60000, syncMax: 6,
    sessionMaxAgeMs: 8 * 60 * 60 * 1000,
  });
}
