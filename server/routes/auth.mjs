import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { isIP } from 'node:net';
import { isLoopback } from '../config/env.mjs';
import { hashPassword, verifyPassword, readUsers, validateUser, publicUser } from '../services/users.mjs';
import { AccountError, updateAccount } from '../services/account.mjs';

const dummyHashPromise = hashPassword(randomBytes(40).toString('hex'));
const DEMO_USER = Object.freeze({ id: 'demo-user', name: 'Pengguna DEMO — Fiktif', email: 'demo@example.invalid', role: 'coordinator' });
const fingerprint = (hash) => createHash('sha256').update(hash).digest('hex');
const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((e) => e ? reject(e) : resolve()));
const save = (req) => new Promise((resolve, reject) => req.session.save((e) => e ? reject(e) : resolve()));

export async function installAuth(app, { config, options, cookieName }) {
  const getUsers = options.users ? async () => options.users.map(validateUser) : options.accountRepository
    ? () => options.accountRepository.readUsers() : () => readUsers(config.usersFile, { optional: config.mode === 'demo' });
  await getUsers(); // Malformed/absent live allowlists are startup errors, never an open-access fallback.
  const dummyHash = await dummyHashPromise;
  const demoAvailable = (req) => {
    const forwarded = req.get('X-Forwarded-For');
    return config.mode === 'demo' && config.nodeEnv !== 'production' && isLoopback(req.socket.remoteAddress)
      && (!forwarded || forwarded.split(',').every((address) => isLoopback(address.trim())));
  };
  const loginOptions = {
    ...(config.isVercel ? { keyGenerator: req => {
      const forwarded = req.get('x-forwarded-for')?.split(',')[0]?.trim();
      return ipKeyGenerator(isIP(forwarded || '') ? forwarded : req.ip);
    } } : {}),
    windowMs: options.limits?.loginWindowMs || config.loginWindowMs,
    limit: options.limits?.loginMax || config.loginMax,
    standardHeaders: 'draft-8', legacyHeaders: false,
    // Forwarded addresses are intentionally ignored unless loopback proxy trust is explicitly enabled.
    validate: { xForwardedForHeader: false },
    message: { error: 'Terlalu banyak percobaan masuk. Coba lagi nanti.' },
  };
  const ipLimit = rateLimit({ ...loginOptions, ...(options.rateStore ? { store: options.rateStore('login-ip') } : {}) });
  const accountLimit = rateLimit({ ...loginOptions, ...(options.rateStore ? { store: options.rateStore('login-account') } : {}), keyGenerator: (req) => fingerprint(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'invalid') });

  app.use('/api', async (req, res, next) => {
    req.user = null;
    const auth = req.session.auth;
    if (!auth) return next();
    if (auth.mode === config.mode && auth.type === 'demo' && demoAvailable(req)) req.user = DEMO_USER;
    else if (auth.mode === config.mode && auth.type === 'approved') {
      try {
        const user = (await getUsers()).find((entry) => entry.id === auth.id);
        if (user && fingerprint(user.passwordHash) === auth.fingerprint) req.user = publicUser(user);
      } catch { /* Any unreadable/invalid allowlist revokes access until repaired. */ }
    }
    if (!req.user) delete req.session.auth;
    next();
  });
  app.get('/api/auth/session', (req, res) => res.json({ user: req.user, demoAvailable: demoAvailable(req) }));
  app.post('/api/auth/login', ipLimit, accountLimit, async (req, res) => {
    const started = performance.now();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' && req.body.password.length <= 256 ? req.body.password : '';
    let user;
    try { user = (await getUsers()).find((entry) => entry.email === email); } catch { /* Same generic failure as an unknown account. */ }
    const verified = await verifyPassword(password, user?.passwordHash || dummyHash);
    await delay(Math.max(0, (options.authDelayMs ?? 250) + randomBytes(1)[0] % 31 - (performance.now() - started)));
    if (!user || !verified) return res.status(401).json({ error: 'Email atau kata sandi tidak valid.' });
    await regenerate(req);
    req.session.auth = { type: 'approved', mode: config.mode, id: user.id, fingerprint: fingerprint(user.passwordHash) };
    await save(req);
    res.json({ user: publicUser(user) });
  });
  app.post('/api/auth/demo', ipLimit, async (req, res) => {
    if (!demoAvailable(req)) return res.status(403).json({ error: 'Login demo hanya tersedia untuk data fiktif di komputer lokal.' });
    await regenerate(req);
    req.session.auth = { type: 'demo', mode: 'demo', id: DEMO_USER.id };
    await save(req);
    res.json({ user: DEMO_USER });
  });
  const accountUpdateOptions = {
    ...loginOptions,
    windowMs: options.limits?.accountWindowMs ?? config.loginWindowMs,
    limit: options.limits?.accountMax ?? 5,
    message: { error: 'ACCOUNT_RATE_LIMITED', message: 'Terlalu banyak percobaan mengubah akun. Coba lagi nanti.' },
  };
  const accountUpdateIpLimit = rateLimit({ ...accountUpdateOptions, ...(options.rateStore ? { store: options.rateStore('account-ip') } : {}) });
  const accountUpdateUserLimit = rateLimit({ ...accountUpdateOptions, ...(options.rateStore ? { store: options.rateStore('account-user') } : {}), keyGenerator: req => fingerprint(req.user.id) });
  const requireApprovedAccount = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Silakan masuk untuk memperbarui akun.' });
    if (req.session.auth?.type !== 'approved') return res.status(403).json({ message: 'Akun demo tidak dapat diperbarui.' });
    if (options.users !== undefined) return res.status(403).json({ message: 'Pembaruan akun tidak tersedia untuk konfigurasi ini.' });
    next();
  };
  app.post('/api/auth/account', requireApprovedAccount, accountUpdateIpLimit, accountUpdateUserLimit, async (req, res) => {
    try {
      const updater = options.accountRepository ? args => options.accountRepository.updateAccount(args) : updateAccount;
      await updater({ file: config.usersFile, root: config.root, id: req.user.id,
        expectedFingerprint: req.session.auth.fingerprint, email: req.body?.email,
        currentPassword: req.body?.currentPassword, newPassword: req.body?.newPassword, confirmPassword: req.body?.confirmPassword });
    } catch (error) {
      if (error instanceof AccountError) return res.status(error.status).json({ message: error.message });
      return res.status(503).json({ message: 'Akun tidak dapat diperbarui. Coba lagi nanti.' });
    }
    const finish = () => {
      if (res.headersSent) return;
      res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: config.nodeEnv === 'production', path: '/' });
      res.json({ ok: true, reauthenticate: true, message: 'Akun berhasil diperbarui. Silakan masuk kembali.' });
    };
    // The persisted hash already revokes every previous session, even if store cleanup fails.
    try { req.session.destroy(finish); } catch { finish(); }
  });
  app.post('/api/auth/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: config.nodeEnv === 'production', path: '/' });
      res.json({ ok: true });
    });
  });
  return (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Silakan masuk untuk mengakses data.' });
}
