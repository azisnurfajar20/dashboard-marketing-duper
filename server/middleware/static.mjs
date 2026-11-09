import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';

const privateSegment = /^(server|scripts|docs|tests|shared|src|node_modules)$/i;
const allowedExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.webmanifest']);

export function staticDashboard(distDir) {
  const root = path.resolve(distDir);
  return async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(404).json({ error: 'Halaman tidak ditemukan.' });
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.status(400).json({ error: 'Alamat tidak valid.' }); }
    const segments = pathname.split('/').filter(Boolean);
    if (pathname.includes('\\') || segments.some((segment) => segment.startsWith('.')) || privateSegment.test(segments[0] || '')) {
      return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
    }
    const extension = path.extname(pathname).toLowerCase();
    if (extension && !allowedExtensions.has(extension)) return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
    const candidate = extension ? path.join(root, ...segments) : path.join(root, 'index.html');
    try {
      const [actualRoot, actualFile] = await Promise.all([realpath(root), realpath(candidate)]);
      const relative = path.relative(actualRoot, actualFile);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !(await stat(actualFile)).isFile()) {
        return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
      }
      res.set('Cache-Control', extension && pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache');
      return res.sendFile(actualFile, (error) => {
        if (error && !res.headersSent) res.status(error.status === 404 ? 404 : 500).json({ error: 'Berkas tidak dapat dibaca.' });
      });
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return res.status(404).json({ error: 'Dashboard belum dibangun atau berkas tidak ditemukan. Jalankan npm run build; untuk pengembangan gunakan Vite.' });
      next(error);
    }
  };
}
