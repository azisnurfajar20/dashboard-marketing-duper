export function requestGuard(config) {
  const hosts = new Set(config.allowedHosts.map((entry) => entry.toLowerCase()));
  const origins = new Set(config.allowedOrigins);
  return (req, res, next) => {
    const isApiRequest = /^\/api(?:\/|$)/i.test(req.path);
    const host = req.headers.host;
    if (typeof host !== 'string' || !hosts.has(host.toLowerCase())) return res.status(403).json({ error: 'Host tidak diizinkan.' });
    if (isApiRequest && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!origins.has(req.get('Origin')) || req.get('Sec-Fetch-Site') === 'cross-site') {
        return res.status(403).json({ error: 'Permintaan harus berasal dari dashboard yang sama.' });
      }
      if (!req.is('application/json')) return res.status(415).json({ error: 'Gunakan application/json.' });
    }
    next();
  };
}

export function safeErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : 500;
  const message = status === 413 ? 'Ukuran permintaan terlalu besar.' : status === 400 ? 'JSON permintaan tidak valid.' : 'Permintaan tidak dapat diproses. Coba lagi atau hubungi administrator.';
  res.status(status).json({ error: message });
}
