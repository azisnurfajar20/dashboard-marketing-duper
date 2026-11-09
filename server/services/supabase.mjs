import session from 'express-session';
import { createHash } from 'node:crypto';
import { validateUser, verifyPassword, hashPassword } from './users.mjs';
import { AccountError, validateAccountChange } from './account.mjs';

// This module is server-only. Never import it into src/ or expose its key.
export function createSupabase(config, { fetchImpl = fetch } = {}) {
  const base = `${config.supabaseUrl}/rest/v1/`;
  async function request(resource, { method = 'GET', body, prefer } = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(resource, base), {
        method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: {
          apikey: config.supabaseKey,
          // Supabase secret keys use apikey; legacy service_role JWTs also use Bearer.
          ...(config.supabaseKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${config.supabaseKey}` }),
          'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new Error('Supabase tidak dapat dihubungi. Periksa koneksi dan konfigurasi server.'); }
    if (!response.ok) {
      if (response.status === 409) throw new AccountError(409, 'Alamat email atau ID tidak dapat digunakan.');
      throw new Error('Permintaan database gagal. Periksa konfigurasi Supabase dan jalankan SQL pemasangan.');
    }
    if (response.status === 204 || prefer === 'return=minimal') return null;
    const content = await response.text();
    if (!content.trim()) throw new Error('Respons database tidak lengkap. Coba lagi nanti.');
    try { return JSON.parse(content); }
    catch { throw new Error('Format respons database tidak valid. Coba lagi nanti.'); }
  }
  const rpc = (name, body) => request(`rpc/${name}`, { method: 'POST', body });
  const toUser = row => validateUser({ ...row, passwordHash: row.password_hash });
  const repository = {
    async readUsers() {
      const rows = await request('marketing_users?select=id,name,email,role,password_hash&limit=1000');
      return rows.map(toUser);
    },
    async addUser(user) {
      const valid = validateUser(user);
      await request('marketing_users', { method: 'POST', prefer: 'return=minimal', body: {
        id: valid.id, name: valid.name, email: valid.email, role: valid.role, password_hash: valid.passwordHash,
      } });
    },
    async updateAccount(args) {
      const { normalizedEmail, changePassword } = validateAccountChange(args);
      const user = (await repository.readUsers()).find(row => row.id === args.id);
      const fingerprint = user && createHash('sha256').update(user.passwordHash).digest('hex');
      if (!user || fingerprint !== args.expectedFingerprint) throw new AccountError(401, 'Sesi berakhir. Silakan masuk kembali.');
      if (!await verifyPassword(args.currentPassword, user.passwordHash)) throw new AccountError(400, 'Kata sandi saat ini tidak valid.');
      if (!changePassword && normalizedEmail === user.email) throw new AccountError(400, 'Tidak ada perubahan akun.');
      const passwordHash = await hashPassword(changePassword ? args.newPassword : args.currentPassword);
      const result = await rpc('marketing_update_account', {
        p_id: user.id, p_old_hash: user.passwordHash, p_email: normalizedEmail, p_new_hash: passwordHash,
      });
      if (!result) throw new AccountError(409, 'Akun telah berubah. Silakan masuk kembali.');
    },
  };
  return { repository, rpc };
}

export class SupabaseSessionStore extends session.Store {
  constructor(client, { namespace, ttlMs }) {
    super(); this.client = client; this.namespace = namespace; this.ttlMs = ttlMs;
  }
  run(operation, sid, value, callback) {
    // Store a one-way digest instead of a usable session cookie identifier.
    const key = createHash('sha256').update(`${this.namespace}:${sid}`).digest('hex');
    this.client.rpc('marketing_session', {
      p_op: operation, p_sid: key, p_value: value || null, p_ttl_seconds: Math.ceil(this.ttlMs / 1000),
    }).then(result => callback?.(null, result), () => callback?.(new Error('Penyimpanan sesi tidak tersedia.')));
  }
  get(sid, callback) { this.run('get', sid, null, callback); }
  set(sid, value, callback) { this.run('set', sid, value, callback); }
  touch(sid, value, callback) { this.run('touch', sid, null, callback); }
  destroy(sid, callback) { this.run('destroy', sid, null, callback); }
}

export class SupabaseRateLimitStore {
  constructor(client, prefix) { this.client = client; this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  async increment(key) {
    const id = createHash('sha256').update(`${this.prefix}:${key}`).digest('hex');
    const row = await this.client.rpc('marketing_rate_limit', { p_key: id, p_window_ms: this.windowMs });
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }
  async decrement() {} // All attempts count, including successful ones.
  async resetKey() {} // Expiry is enforced atomically by the database.
}