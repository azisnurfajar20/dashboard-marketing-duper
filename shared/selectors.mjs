const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function jakartaToday(now = new Date()) {
  const parts = Object.fromEntries(jakartaDateFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const text = (value) => value == null ? '' : String(value).trim();
const key = (value) => text(value).toLocaleLowerCase('id');

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function classifyFollowUp(visit, today = jakartaToday()) {
  const status = key(visit.followUpStatus);
  if (status === 'selesai') return 'completed';
  if (status === 'dibatalkan') return 'cancelled';
  const date = text(visit.followUpDate);
  if (visit.invalidFollowUpDate || (date && !isIsoDate(date))) return 'invalid';
  if (!status && !text(visit.nextAction)) return 'none';
  if (status !== 'belum selesai') return 'status-missing';
  if (!date) return 'unscheduled';
  return date < today ? 'overdue' : date === today ? 'today' : 'upcoming';
}

function selectedYear(data, year) {
  return text(year) ? Number(year) : Math.max(0, ...(data.years ?? []));
}

function tiersForYear(data, year) {
  return new Map((data.tiers ?? []).filter((entry) => entry.year === year).map((entry) => [entry.schoolId, entry]));
}

const nameCollator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });
const byName = (a, b) => nameCollator.compare(a.name, b.name) || nameCollator.compare(a.id, b.id);

export function filterSchools(data, filters = {}) {
  const search = key(filters.search);
  const schoolIds = Array.isArray(filters.schoolIds) ? new Set(filters.schoolIds) : null;
  const tiers = tiersForYear(data, selectedYear(data, filters.year));
  return (data.schools ?? []).filter((school) => {
    if (schoolIds && !schoolIds.has(school.id)) return false;
    if (search && !key(school.name).includes(search) && !key(school.id).includes(search)) return false;
    for (const field of ['region', 'owner', 'status']) {
      if (text(filters[field]) && key(school[field]) !== key(filters[field])) return false;
    }
    const tierFilter = text(filters.tier);
    if (!tierFilter) return true;
    const entry = tiers.get(school.id);
    if (tierFilter === 'invalid') return entry?.invalid === true;
    if (tierFilter === 'unassessed') return !entry?.invalid && !entry?.tier;
    return !entry?.invalid && entry?.tier === tierFilter;
  }).sort((a, b) => {
    if (filters.sort === 'name-desc') return -byName(a, b);
    if (filters.sort === 'last-visit') {
      const aDate = a.lastVisitDate ?? '';
      const bDate = b.lastVisitDate ?? '';
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
    }
    return byName(a, b);
  });
}

export function filterVisits(data, filters = {}) {
  const start = text(filters.start);
  const end = text(filters.end);
  if ((start && !isIsoDate(start)) || (end && !isIsoDate(end)) || (start && end && start > end)) return [];
  const schools = new Map((data.schools ?? []).map((school) => [school.id, school]));
  const schoolIds = Array.isArray(filters.schoolIds) ? new Set(filters.schoolIds) : null;
  return (data.visits ?? []).filter((visit) => {
    const school = schools.get(visit.schoolId);
    if (!school) return false;
    if (schoolIds && !schoolIds.has(visit.schoolId)) return false;
    if (text(filters.schoolId) && visit.schoolId !== filters.schoolId) return false;
    if (start && visit.date < start) return false;
    if (end && visit.date > end) return false;
    if (text(filters.region) && key(school.region) !== key(filters.region)) return false;
    if (text(filters.marketer) && key(visit.marketer) !== key(filters.marketer)) return false;
    if (text(filters.activity) && !visit.activities.some((activity) => key(activity) === key(filters.activity))) return false;
    return true;
  });
}

function uniqueIds(records) {
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function dashboardSummary(data, filters = {}) {
  const schools = uniqueIds(filterSchools(data, filters));
  const schoolIds = schools.map((school) => school.id);
  const tiers = tiersForYear(data, selectedYear(data, filters.year));
  const summary = {
    totalSchools: schools.length, activeSchools: 0, tier1: 0, tier2: 0, tier3: 0,
    unassessed: 0, invalidTier: 0, visits: 0, visitedSchools: 0, followUpToday: 0, followUpOverdue: 0,
  };
  for (const school of schools) {
    if (key(school.status) === 'aktif') summary.activeSchools++;
    const entry = tiers.get(school.id);
    if (entry?.invalid) summary.invalidTier++;
    else if (!entry?.tier) summary.unassessed++;
    else summary[`tier${entry.tier.slice(-1)}`]++;
  }
  const visits = uniqueIds(filterVisits(data, { ...filters, schoolIds }));
  summary.visits = visits.length;
  summary.visitedSchools = new Set(visits.map((visit) => visit.schoolId)).size;
  const today = filters.today || jakartaToday();
  const followUps = uniqueIds(filterVisits(data, { schoolIds, marketer: filters.marketer }));
  for (const visit of followUps) {
    const category = classifyFollowUp(visit, today);
    if (category === 'today') summary.followUpToday++;
    if (category === 'overdue') summary.followUpOverdue++;
  }
  return summary;
}

export function compareTiers(data, fromYear, toYear, filters = {}) {
  const fromTiers = tiersForYear(data, Number(fromYear));
  const toTiers = tiersForYear(data, Number(toYear));
  return uniqueIds(filterSchools(data, { year: toYear, ...filters })).map((school) => {
    const fromEntry = fromTiers.get(school.id);
    const toEntry = toTiers.get(school.id);
    const from = fromEntry?.tier ?? null;
    const to = toEntry?.tier ?? null;
    let change;
    if (fromEntry?.invalid || toEntry?.invalid) change = 'invalid';
    else if (!from || !to) change = 'unassessed';
    else if (from === to) change = 'unchanged';
    else change = Number(to.slice(-1)) < Number(from.slice(-1)) ? 'improved' : 'declined';
    return { school, from, to, change };
  });
}
