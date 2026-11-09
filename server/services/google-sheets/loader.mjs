import { GoogleAuth } from 'google-auth-library';
import { setTimeout as wait } from 'node:timers/promises';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export const SHEET_TABS = Object.freeze(['Data Sekolah', 'Data Pic Sekolah', 'Data Tier Sekolah', 'Riwayat Kunjungan']);

function transient(error) {
  const status = Number(error?.response?.status || 0);
  return status === 429 || status >= 500 || ['ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT', 'ENOTFOUND'].includes(error?.code) || ['AbortError', 'TimeoutError'].includes(error?.name);
}

async function bounded(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise((resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('READ_TIMEOUT'), { name: 'TimeoutError' })); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function createGoogleSheetsLoader(config, { auth, credentials, timeoutMs = 8000, maxAttempts = 3, sleep = wait } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000 || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new Error('Invalid Google read limits.');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(config.spreadsheetId || '')) throw new Error('GOOGLE_SPREADSHEET_ID is invalid.');
  const google = auth || new GoogleAuth({
    ...(credentials ? { credentials } : { keyFile: config.serviceAccountFile }),
    scopes: [SHEETS_SCOPE],
    clientOptions: { transporterOptions: { timeout: timeoutMs, retry: false } },
  });
  const endpoint = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values:batchGet`);
  for (const tab of SHEET_TABS) endpoint.searchParams.append('ranges', `'${tab}'`);
  endpoint.searchParams.set('majorDimension', 'ROWS');
  endpoint.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  endpoint.searchParams.set('dateTimeRenderOption', 'SERIAL_NUMBER');
  let clientPromise;
  return async () => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await bounded(async (signal) => {
          clientPromise ||= google.getClient();
          const client = await clientPromise;
          return client.request({ url: endpoint.href, method: 'GET', timeout: timeoutMs, signal, retry: false, responseType: 'json', maxContentLength: 32 * 1024 * 1024 });
        }, timeoutMs);
        const ranges = response.data?.valueRanges;
        if (!Array.isArray(ranges) || ranges.length !== SHEET_TABS.length) throw new Error('INVALID_RESPONSE');
        return Object.fromEntries(SHEET_TABS.map((tab, index) => [tab, Array.isArray(ranges[index].values) ? ranges[index].values : []]));
      } catch (error) {
        clientPromise = null;
        if (attempt + 1 < maxAttempts && transient(error)) { await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 100)); continue; }
        // Never propagate API bodies, request headers, tokens, key paths or response secrets.
        throw new Error('Google Sheets tidak dapat dibaca. Periksa akses dan kredensial pada server.');
      }
    }
  };
}
