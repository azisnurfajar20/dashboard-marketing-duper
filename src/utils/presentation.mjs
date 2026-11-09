export function countBy(rows, getKey) {
  const counts = new Map();
  for (const row of rows) {
    const label = String(getKey(row) || 'Belum diisi');
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'id'));
}

export function monthlyVisits(visits, start = '', end = '', today = new Date().toISOString().slice(0, 10)) {
  const dates = visits.map(v => v.date).sort();
  const first = (start || dates[0] || today).slice(0, 7);
  const last = (end || dates.at(-1) || today).slice(0, 7);
  if (first > last) return [];
  const counts = countBy(visits, v => v.date.slice(0, 7));
  const map = new Map(counts.map(x => [x.label, x.value]));
  const cursor = new Date(`${first}-01T00:00:00Z`);
  const result = [];
  while (cursor.toISOString().slice(0, 7) <= last) {
    const key = cursor.toISOString().slice(0, 7);
    result.push({ key, label: new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(cursor), value: map.get(key) || 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

export function paginate(rows, requestedPage = 1, size = 10) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pages, Math.max(1, Number(requestedPage) || 1));
  const offset = (page - 1) * size;
  return { rows: rows.slice(offset, offset + size), page, pages, total: rows.length, from: rows.length ? offset + 1 : 0, to: Math.min(offset + size, rows.length) };
}

export function tierFor(data, schoolId, year) {
  const item = data.tiers.find(t => t.schoolId === schoolId && Number(t.year) === Number(year));
  return item?.invalid ? 'invalid' : item?.tier || 'unassessed';
}

export function uniqueOptions(rows, field) {
  return [...new Set(rows.map(row => row[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id'));
}
