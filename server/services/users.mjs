import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const derive = promisify(scrypt);
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_PATTERN = /^scrypt\$32768\$8\$1\$([a-f0-9]{64})\$([a-f0-9]{128})$/;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256 || password.includes('\0')) {
    throw new Error('Password must contain 12 to 256 characters.');
  }
  const salt = randomBytes(32).toString('hex');
  const key = await derive(password, salt, 64, COST);
  return `scrypt$32768$8$1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const match = typeof passwordHash === 'string' ? HASH_PATTERN.exec(passwordHash) : null;
  if (!match || typeof password !== 'string' || password.length > 256) return false;
  const key = await derive(password, match[1], 64, COST);
  return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}

export function validateUser(user) {
  if (!user || typeof user !== 'object' || !/^[\w-]{1,80}$/.test(user.id || '')) throw new Error('Approved user id is invalid.');
  if (typeof user.name !== 'string' || !user.name.trim() || user.name.length > 120 || /[\r\n\0]/.test(user.name)) throw new Error('Approved user name is invalid.');
  if (typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim())) throw new Error('Approved user email is invalid.');
  if (!['admin', 'coordinator', 'marketing'].includes(user.role)) throw new Error('Approved user role is invalid.');
  if (!HASH_PATTERN.test(user.passwordHash || '')) throw new Error('Approved user passwordHash must use the supported scrypt format.');
  return { id: user.id, name: user.name.trim(), email: user.email.trim().toLowerCase(), role: user.role, passwordHash: user.passwordHash };
}

export const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });

export async function readUsers(file, { optional = false } = {}) {
  let content;
  try { content = await readFile(file, 'utf8'); } catch (error) {
    if (optional && error.code === 'ENOENT') return [];
    throw new Error('Approved users file could not be read.');
  }
  let values;
  try { values = JSON.parse(content); } catch { throw new Error('Approved users file must contain valid JSON.'); }
  if (!Array.isArray(values) || values.length > 1000) throw new Error('Approved users file must be an array of at most 1000 users.');
  const users = values.map(validateUser);
  if (new Set(users.map((u) => u.id)).size !== users.length || new Set(users.map((u) => u.email)).size !== users.length) {
    throw new Error('Approved user IDs and emails must be unique.');
  }
  if (!optional && users.length === 0) throw new Error('Live mode requires at least one approved user.');
  return users;
}
