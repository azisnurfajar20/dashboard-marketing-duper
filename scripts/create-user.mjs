import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, open, rename, rm, chmod } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import dotenv from 'dotenv';
import { ROOT } from '../server/config/env.mjs';
import { assertPrivatePaths } from '../server/config/private.mjs';
import { hashPassword, readUsers, validateUser, publicUser } from '../server/services/users.mjs';
import { createSupabase } from '../server/services/supabase.mjs';

export { hashPassword, verifyPassword } from '../server/services/users.mjs';

export async function addApprovedUser({ file, name, email, password, role = 'marketing', id = randomUUID(), root = ROOT }) {
  const filename = path.resolve(file || path.join(root, 'server/config/users.json'));
  for (const folder of ['public', 'dist', 'src']) {
    const relative = path.relative(path.join(root, folder), filename);
    if (!relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error('Users file must be outside public, dist and src.');
  }
  await assertPrivatePaths(root, [filename]);
  const user = validateUser({ id, name, email, role, passwordHash: await hashPassword(password) });
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  let lock;
  try { lock = await open(`${filename}.lock`, 'wx', 0o600); } catch { throw new Error('Users file is locked by another operation.'); }
  const temporary = `${filename}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    const users = await readUsers(filename, { optional: true });
    if (users.some((existing) => existing.email === user.email || existing.id === user.id)) throw new Error('Approved user already exists.');
    const output = await open(temporary, 'wx', 0o600);
    try { await output.writeFile(`${JSON.stringify([...users, user], null, 2)}\n`, 'utf8'); await output.sync(); } finally { await output.close(); }
    await rename(temporary, filename);
    await chmod(filename, 0o600);
    return publicUser(user);
  } finally {
    await rm(temporary, { force: true });
    await lock.close();
    await rm(`${filename}.lock`, { force: true });
  }
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--stdin-json') { options.stdinJson = true; continue; }
    if (!['--name', '--email', '--role', '--file', '--id'].includes(arg) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Use --name, --email, --role, --file or --stdin-json. Passwords are accepted only via stdin or a hidden prompt, never as command arguments.');
    }
    options[arg.slice(2)] = args[++index];
  }
  return options;
}

async function hiddenPassword(label) {
  process.stdout.write(label);
  const muted = new Writable({ write(chunk, encoding, callback) { callback(); } });
  muted.isTTY = true;
  const input = createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    const answer = await input.question('');
    process.stdout.write('\n');
    return answer;
  } finally { input.close(); }
}

export async function main(args = process.argv.slice(2)) {
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
  const options = parseArgs(args);
  if (process.stdin.isTTY) {
    if (options.stdinJson) throw new Error('--stdin-json requires piped stdin.');
    const prompts = createInterface({ input: process.stdin, output: process.stdout });
    try {
      options.name ||= await prompts.question('Approved display name: ');
      options.email ||= await prompts.question('Approved email: ');
      options.role ||= (await prompts.question('Role [marketing/admin/coordinator] (marketing): ')) || 'marketing';
    } finally { prompts.close(); }
    options.password = await hiddenPassword('Password (12–256 characters, hidden): ');
    const confirmation = await hiddenPassword('Confirm password (hidden): ');
    if (confirmation !== options.password) throw new Error('Passwords do not match.');
  } else {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString('utf8');
      if (Buffer.byteLength(input) > 8192) throw new Error('Stdin is too large.');
    }
    if (options.stdinJson) {
      let record;
      try { record = JSON.parse(input); } catch { throw new Error('Stdin must be valid JSON.'); }
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Stdin must be a JSON object.');
      for (const key of ['name', 'email', 'password', 'role', 'id']) if (record[key] !== undefined) options[key] = record[key];
    } else options.password = input.replace(/\r?\n$/, '');
  }
  options.file ||= process.env.USERS_FILE ? path.resolve(ROOT, process.env.USERS_FILE) : path.join(ROOT, 'server/config/users.json');
  if (process.env.STORAGE_BACKEND === 'supabase') {
    let url;
    try { url = new URL(process.env.SUPABASE_URL); } catch { throw new Error('SUPABASE_URL is required.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SUPABASE_URL must be an HTTPS project origin.');
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SECRET_KEY is required.');
    const { repository } = createSupabase({ supabaseUrl: url.origin, supabaseKey: key });
    await repository.addUser({ id: options.id || randomUUID(), name: options.name, email: options.email,
      role: options.role || 'marketing', passwordHash: await hashPassword(options.password) });
  } else await addApprovedUser(options);
  process.stdout.write('Approved user created. Password and hash are not displayed.\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); } catch (error) {
    // Validation errors are fixed safe strings; do not print arbitrary I/O errors or stdin.
    console.error(error.code ? 'Cannot update private users file. Check the path and permissions.' : error.message);
    process.exitCode = 1;
  }
}
