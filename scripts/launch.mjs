import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export async function isDashboardRunning(origin) {
  try {
    const [health, home] = await Promise.all([
      fetch(new URL('/api/health', origin), { signal: AbortSignal.timeout(1500), redirect: 'error' }),
      fetch(new URL('/', origin), { signal: AbortSignal.timeout(1500), redirect: 'error' }),
    ]);
    if (!health.ok || !home.ok) return false;
    const [status, html] = await Promise.all([health.json(), home.text()]);
    return status.ok === true && html.includes('Monitor Marketing') && html.includes('LPK Duta Persada');
  } catch { return false; }
}

function openLocalBrowser(origin) {
  if (process.platform !== 'win32') return;
  const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', origin], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
}

export async function launchDashboard({ origin, probe = isDashboardRunning, start, open = openLocalBrowser, log = console.log }) {
  if (await probe(origin)) {
    log(`Dashboard sudah berjalan: ${origin}`);
    open(origin);
    return { reused: true };
  }
  const running = await start();
  if (!await probe(origin)) {
    await running.close();
    throw new Error('Dashboard belum menjawab pemeriksaan koneksi.');
  }
  log(`Dashboard siap: ${origin}`);
  log('Biarkan terminal ini terbuka. Tekan Ctrl+C untuk berhenti.');
  open(origin);
  return { reused: false, running };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { startServer } = await import('../server/index.mjs');
    const { readConfig } = await import('../server/config/env.mjs');
    const config = readConfig();
    const result = await launchDashboard({ origin: config.appOrigin, start: () => startServer() });
    if (result.running) {
      let closing = false;
      const close = async () => {
        if (closing) return;
        closing = true;
        const timeout = setTimeout(() => process.exit(1), 10000);
        timeout.unref();
        await result.running.close();
        clearTimeout(timeout);
      };
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    }
  } catch {
    console.error('Dashboard tidak dapat dimulai. Pastikan port tidak dipakai aplikasi lain dan konfigurasi .env sudah benar.');
    process.exitCode = 1;
  }
}
