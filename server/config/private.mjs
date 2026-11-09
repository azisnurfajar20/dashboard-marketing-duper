import path from 'node:path';
import { realpath, readFile, stat } from 'node:fs/promises';
import { createPrivateKey } from 'node:crypto';

async function canonical(filename) {
  let current = path.resolve(filename);
  const suffix = [];
  while (true) {
    try { return path.join(await realpath(current), ...suffix.reverse()); } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw new Error('Private storage path cannot be resolved.');
      const parent = path.dirname(current);
      if (parent === current) throw new Error('Private storage path cannot be resolved.');
      suffix.push(path.basename(current));
      current = parent;
    }
  }
}

export async function assertPrivatePaths(root, filenames) {
  const publicRoots = await Promise.all(['public', 'dist', 'src'].map((folder) => canonical(path.join(root, folder))));
  for (const filename of filenames.filter(Boolean)) {
    const actual = await canonical(filename);
    for (const publicRoot of publicRoots) {
      const relative = path.relative(publicRoot, actual);
      if (!relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
        throw new Error('Private storage must be outside public, dist and src, including symlink targets.');
      }
    }
  }
}

export async function validateServiceAccount(filename, { json } = {}) {
  try {
    let content;
    if (json !== undefined && json !== '') {
      if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > 1024 * 1024) throw new Error('INVALID_CREDENTIAL_JSON');
      content = json;
    } else {
      const metadata = await stat(filename);
      if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error('INVALID_CREDENTIAL_FILE');
      content = await readFile(filename, 'utf8');
    }
    const credentials = JSON.parse(content);
    if (credentials.type !== 'service_account' || !/^[^@\s]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(credentials.client_email || '')) throw new Error('INVALID_SERVICE_ACCOUNT');
    if (credentials.token_uri && credentials.token_uri !== 'https://oauth2.googleapis.com/token') throw new Error('INVALID_TOKEN_ENDPOINT');
    if (credentials.universe_domain && credentials.universe_domain !== 'googleapis.com') throw new Error('INVALID_CREDENTIAL_UNIVERSE');
    if (typeof credentials.private_key !== 'string') throw new Error('INVALID_PRIVATE_KEY');
    const key = createPrivateKey(credentials.private_key);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength < 2048) throw new Error('INVALID_PRIVATE_KEY');
    return credentials;
  } catch {
    // Do not expose raw JSON, private-key material or filesystem paths in startup/API errors.
    throw new Error('Google service-account credentials are missing or invalid. Use GOOGLE_SERVICE_ACCOUNT_JSON or a private service_account JSON file.');
  }
}
