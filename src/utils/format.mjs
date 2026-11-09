export function formatDate(value) {
  if (!value) return 'Belum ada';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak valid' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);
}

export function formatTimestamp(value) {
  if (!value) return 'Belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak valid';
  return `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(date)} WIB`;
}

export const number = value => new Intl.NumberFormat('id-ID').format(Number(value) || 0);
export const initials = value => String(value || 'Pengguna').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

export function presetRange(preset, today) {
  if (preset === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (preset === 'year') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (preset === 'last30') {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 29);
    return { start: date.toISOString().slice(0, 10), end: today };
  }
  return { start: '', end: '' };
}

export function whatsappHref(value) {
  const text = String(value || '').trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('08')) digits = `62${digits.slice(1)}`;
  return /^628\d{8,11}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

export function spreadsheetHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'docs.google.com' && !url.username && !url.password && /^\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
