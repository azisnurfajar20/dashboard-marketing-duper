const pages = new Set(['dashboard', 'schools', 'tiers', 'visits', 'follow-ups', 'data-status', 'account', 'login']);

export function parseRoute(hash = '') {
  const [rawPath, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = (rawPath || '/dashboard').split('/').filter(Boolean);
  const filters = Object.fromEntries(new URLSearchParams(query));
  if (parts[0] === 'schools' && parts.length === 2) {
    try { return { page: 'school-detail', id: decodeURIComponent(parts[1]), filters }; }
    catch { return { page: 'not-found', filters }; }
  }
  return { page: parts.length === 1 && pages.has(parts[0]) ? parts[0] : 'not-found', filters };
}

export function routeHref(page, filters = {}, changes = {}, id) {
  const merged = { ...filters, ...changes };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
  }
  const path = id !== undefined ? `/schools/${encodeURIComponent(id)}` : `/${page}`;
  return `#${path}${query.size ? `?${query}` : ''}`;
}
