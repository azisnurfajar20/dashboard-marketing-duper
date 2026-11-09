import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { normalizeWorkbook } from '../../shared/data.mjs';

const validData = (data) => data && ['schools', 'pics', 'tiers', 'visits', 'years', 'issues'].every((key) => Array.isArray(data[key])) && data.hasFatalIssues === false;

export async function createSyncService({ mode, spreadsheetId = '', cacheDir, workbookLoader, normalizer = normalizeWorkbook, now = () => new Date(), intervalMs = 300000 }) {
  const identity = { mode, spreadsheetId: mode === 'sheets' ? spreadsheetId : 'fictional-demo-v1' };
  const namespace = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const filename = path.join(cacheDir, `${namespace}.json`);
  const status = {
    mode, connection: mode === 'demo' ? 'demo' : 'not_configured',
    lastSuccessAt: null, lastAttemptAt: null, error: null,
    spreadsheetUrl: mode === 'sheets' ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null,
    nextSyncAt: null, issues: [],
  };
  let data = null;
  let pending = null;
  let timer = null;
  let closed = false;
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  try {
    const cached = JSON.parse(await readFile(filename, 'utf8'));
    if (cached.version === 1 && JSON.stringify(cached.identity) === JSON.stringify(identity) && validData(cached.data) && Number.isFinite(Date.parse(cached.lastSuccessAt))) {
      data = cached.data;
      status.lastSuccessAt = cached.lastSuccessAt;
      status.issues = data.issues;
      status.connection = mode === 'demo' ? 'demo' : 'error';
      if (mode === 'sheets') status.error = 'Data cache terakhir tersedia; koneksi belum diverifikasi pada proses ini.';
    }
  } catch { /* Missing/corrupt cache never creates an invented empty dataset. */ }
  const snapshot = () => structuredClone({ data, status });
  async function sync() {
    if (pending) return pending;
    if (closed) return snapshot();
    pending = (async () => {
      status.lastAttemptAt = now().toISOString();
      try {
        const workbook = await workbookLoader();
        const candidate = await normalizer(workbook);
        status.issues = Array.isArray(candidate?.issues) ? candidate.issues : [];
        if (candidate?.hasFatalIssues) {
          status.connection = 'error';
          status.error = 'Kolom atau tab wajib tidak tersedia. Data terakhir yang valid dipertahankan; perbaiki sumber lalu sinkronkan kembali.';
          return snapshot();
        }
        if (!validData(candidate)) throw new Error('INVALID_NORMALIZED_DATA');
        const succeeded = now().toISOString();
        const temporary = `${filename}.${randomBytes(12).toString('hex')}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify({ version: 1, identity, data: candidate, lastSuccessAt: succeeded }), { mode: 0o600, flag: 'wx' });
          await rename(temporary, filename);
        } finally { await rm(temporary, { force: true }); }
        data = candidate;
        status.lastSuccessAt = succeeded;
        status.error = null;
        status.connection = mode === 'demo' ? 'demo' : 'connected';
      } catch {
        status.connection = 'error';
        status.error = 'Sinkronisasi tidak berhasil. Periksa akses spreadsheet, kredensial server, dan koneksi. Data terakhir yang valid tetap ditampilkan jika tersedia.';
      }
      return snapshot();
    })();
    try { return await pending; } finally { pending = null; }
  }
  function start() {
    if (timer || closed) return;
    status.nextSyncAt = new Date(now().getTime() + intervalMs).toISOString();
    timer = setInterval(() => {
      status.nextSyncAt = new Date(now().getTime() + intervalMs).toISOString();
      void sync();
    }, intervalMs);
    timer.unref?.();
  }
  async function stop() {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
    status.nextSyncAt = null;
    if (pending) await pending;
  }
  return { snapshot, sync, start, stop, isSyncing: () => Boolean(pending) };
}
