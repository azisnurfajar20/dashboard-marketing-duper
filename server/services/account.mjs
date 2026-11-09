import { createHash, randomBytes } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';
import { hashPassword, readUsers, verifyPassword } from './users.mjs';
import { assertPrivatePaths } from '../config/private.mjs';
import { ROOT } from '../config/env.mjs';

export class AccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateAccountChange({ email, newPassword, confirmPassword }) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalizedEmail.length > 254 || /[\u0000-\u0020\u007f]/.test(normalizedEmail)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AccountError(400, 'Masukkan alamat email yang valid.');
  }
  const changePassword = newPassword !== undefined && newPassword !== '';
  if (changePassword && (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 256 || newPassword.includes('\0'))) {
    throw new AccountError(400, 'Kata sandi baru harus berisi 12–256 karakter.');
  }
  if (changePassword && confirmPassword !== newPassword) throw new AccountError(400, 'Konfirmasi kata sandi baru tidak cocok.');
  return { normalizedEmail, changePassword };
}

export async function updateAccount({ file, id, expectedFingerprint, email, currentPassword, newPassword, confirmPassword, root = ROOT }) {
  const { normalizedEmail, changePassword } = validateAccountChange({ email, newPassword, confirmPassword });
  let lock;
  let temporary;
  try {
    await assertPrivatePaths(root, [file]);
    try { lock = await open(`${file}.lock`, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new AccountError(409, 'Akun sedang diperbarui. Coba lagi sebentar.');
      throw error;
    }
    const users = await readUsers(file);
    const user = users.find(entry => entry.id === id);
    if (!user || createHash('sha256').update(user.passwordHash).digest('hex') !== expectedFingerprint) {
      throw new AccountError(401, 'Sesi berakhir. Silakan masuk kembali.');
    }
    if (!await verifyPassword(currentPassword, user.passwordHash)) throw new AccountError(400, 'Kata sandi saat ini tidak valid.');
    if (users.some(entry => entry.id !== id && entry.email === normalizedEmail)) throw new AccountError(409, 'Alamat email tidak dapat digunakan.');
    if (!changePassword && normalizedEmail === user.email) throw new AccountError(400, 'Tidak ada perubahan akun.');
    user.email = normalizedEmail;
    // Rotate the hash even for email-only changes to invalidate all older session fingerprints.
    user.passwordHash = await hashPassword(changePassword ? newPassword : currentPassword);
    temporary = `${file}.${randomBytes(12).toString('hex')}.tmp`;
    const output = await open(temporary, 'wx', 0o600);
    try {
      await output.writeFile(`${JSON.stringify(users, null, 2)}\n`, 'utf8');
      await output.sync();
    } finally { await output.close(); }
    await rename(temporary, file);
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError(503, 'Akun tidak dapat diperbarui. Coba lagi nanti.');
  } finally {
    // Post-commit cleanup errors cannot undo a successful account update.
    if (temporary) await rm(temporary, { force: true }).catch(() => {});
    if (lock) {
      await lock.close().catch(() => {});
      await rm(`${file}.lock`, { force: true }).catch(() => {});
    }
  }
}
