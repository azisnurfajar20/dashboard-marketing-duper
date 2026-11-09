const text = (value) => value == null ? '' : String(value).trim();
const headerKey = (value) => text(value).toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
const SCHOOL_COLUMNS = {
  id: ['ID Sekolah'], name: ['Nama Sekolah'], region: ['Daerah'], ownership: ['Negeri/Swasta'],
  owner: ['Koordinator/Marketing Penanggung Jawab', 'Koordinator', 'Marketing Penanggung Jawab', 'Koordinator atau marketing penanggung jawab'],
  status: ['Status Sekolah'],
};

const SCHEMAS = {
  'Data Sekolah': SCHOOL_COLUMNS,
  'Data Pic Sekolah': {
    id: ['ID PIC'], schoolId: ['ID Sekolah'], name: ['Nama PIC'], position: ['Jabatan'],
    whatsapp: ['Nomor WhatsApp', 'Nomer WhatsApp', 'No WhatsApp', 'No. WhatsApp', 'WhatsApp', 'Nomor WA', 'No WA'], status: ['Status Kontak', 'Statusm Kontak'],
  },
  'Data Tier Sekolah': { schoolId: ['ID Sekolah'] },
  'Riwayat Kunjungan': {
    id: ['ID Visit', 'ID Kunjungan'], date: ['Tanggal', 'Tanggal Kunjungan'], schoolId: ['ID Sekolah'],
    marketer: ['Marketing pelaksana', 'Marketing'], activities: ['Kegiatan'], pic: ['PIC yang ditemui', 'PIC'],
    result: ['Hasil'], nextAction: ['Next Action', 'Tindak Lanjut'],
    followUpDate: ['Tanggal Follow-up', 'Tanggal Follow Up'], followUpStatus: ['Status Follow-up', 'Status Follow Up'],
  },
};

function columnIndexes(headers, definitions) {
  const keys = headers.map(headerKey);
  return Object.fromEntries(Object.entries(definitions).map(([field, aliases]) => [
    field, keys.findIndex((key) => aliases.some((alias) => headerKey(alias) === key)),
  ]));
}

// Parse only documented calendar forms or Sheets' 1899-12-30 serial epoch.
// Never use Date.parse on free-form input: it silently rolls invalid days forward.
function parseDate(value) {
  const raw = text(value);
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1899 || date.getUTCFullYear() > 9999) return null;
    return date.toISOString().slice(0, 10);
  }
  let year, month, day;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) [, year, month, day] = match.map(Number);
  else {
    match = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(raw);
    if (!match) return null;
    day = Number(match[1]); month = Number(match[3]); year = Number(match[4]);
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeWorkbook(workbook) {
  const result = { schools: [], pics: [], tiers: [], visits: [], years: [], issues: [], hasFatalIssues: false };
  const schemaColumns = {};
  for (const [tab, definitions] of Object.entries(SCHEMAS)) {
    if (!Array.isArray(workbook?.[tab]) || !Array.isArray(workbook[tab][0])) {
      result.issues.push({ code: 'MISSING_TAB', tab, row: 1, column: '-', message: 'Tab wajib tidak tersedia.', severity: 'error' });
      continue;
    }
    const headers = workbook[tab][0];
    schemaColumns[tab] = columnIndexes(headers, definitions);
    for (const [field, index] of Object.entries(schemaColumns[tab])) {
      if (index < 0) {
        result.issues.push({ code: 'MISSING_HEADER', tab, row: 1, column: definitions[field][0], message: 'Kolom wajib tidak tersedia.', severity: 'error' });
      } else if (headers.filter((header) => definitions[field].some((alias) => headerKey(alias) === headerKey(header))).length > 1) {
        result.issues.push({ code: 'AMBIGUOUS_HEADER', tab, row: 1, column: definitions[field][0], message: 'Lebih dari satu kolom mengacu ke bidang wajib yang sama.', severity: 'error' });
      }
    }
    if (tab === 'Data Tier Sekolah') {
      const seenYears = new Set();
      for (const header of headers) {
        const match = /^Tier (\d{4})$/.exec(text(header));
        if (!match) continue;
        if (seenYears.has(match[1])) result.issues.push({ code: 'AMBIGUOUS_HEADER', tab, row: 1, column: `Tier ${match[1]}`, message: 'Kolom tahun tier ganda.', severity: 'error' });
        seenYears.add(match[1]);
      }
    }
    if (tab === 'Data Tier Sekolah' && !headers.some((value) => /^Tier (\d{4})$/.test(text(value)))) {
      result.issues.push({ code: 'MISSING_HEADER', tab, row: 1, column: 'Tier YYYY', message: 'Kolom tahun tier wajib tidak tersedia.', severity: 'error' });
    }
  }
  if (result.issues.length) {
    result.hasFatalIssues = true;
    return result;
  }
  const issue = (record, code, column, message, severity = 'error') => result.issues.push({
    code, ...record.source, column, message, severity,
  });
  const records = (tab) => workbook[tab].slice(1).flatMap((row, index) => {
    if (!Array.isArray(row) || !row.some((value) => text(value))) return [];
    return [{
      ...Object.fromEntries(Object.entries(schemaColumns[tab]).map(([field, column]) => [field, text(row[column])])),
      source: { tab, row: index + 2 },
    }];
  });
  const schoolRecords = records('Data Sekolah');
  const schoolIdCounts = new Map();
  for (const school of schoolRecords) {
    if (school.id) schoolIdCounts.set(school.id, (schoolIdCounts.get(school.id) ?? 0) + 1);
  }
  result.schools = schoolRecords.filter((school) => {
    if (school.id && schoolIdCounts.get(school.id) > 1) {
      issue(school, 'DUPLICATE_SCHOOL_ID', 'ID Sekolah', 'ID sekolah ganda; seluruh salinan dikeluarkan.');
      return false;
    }
    let valid = true;
    for (const field of ['id', 'name']) {
      if (!school[field]) {
        issue(school, 'MISSING_REQUIRED_FIELD', SCHOOL_COLUMNS[field][0], 'Nilai wajib belum diisi.');
        valid = false;
      }
    }
    return valid;
  }).map((school) => ({ ...school, lastVisitDate: null }));
  const schoolsById = new Map(result.schools.map((school) => [school.id, school]));
  const validReference = (record) => {
    if (schoolsById.has(record.schoolId)) return true;
    issue(record, schoolIdCounts.get(record.schoolId) > 1 ? 'AMBIGUOUS_SCHOOL_ID' : 'UNKNOWN_SCHOOL_ID', 'ID Sekolah', 'Referensi ID sekolah tidak ditemukan atau ambigu.');
    return false;
  };
  const picRecords = records('Data Pic Sekolah');
  const picIdCounts = new Map();
  for (const pic of picRecords) if (pic.id) picIdCounts.set(pic.id, (picIdCounts.get(pic.id) ?? 0) + 1);
  result.pics = picRecords.filter((pic) => {
    let valid = validReference(pic);
    if (picIdCounts.get(pic.id) > 1) {
      issue(pic, 'DUPLICATE_PIC_ID', 'ID PIC', 'ID PIC ganda; seluruh salinan dikeluarkan.');
      valid = false;
    }
    for (const field of ['id', 'name']) {
      if (!pic[field]) {
        issue(pic, 'MISSING_REQUIRED_FIELD', SCHEMAS['Data Pic Sekolah'][field][0], 'Nilai wajib belum diisi.');
        valid = false;
      }
    }
    return valid;
  });
  const tierColumns = workbook['Data Tier Sekolah'][0].flatMap((header, index) => {
    const match = /^Tier (\d{4})$/.exec(text(header));
    return match ? [{ year: Number(match[1]), index }] : [];
  }).sort((a, b) => a.year - b.year);
  result.years = tierColumns.map(({ year }) => year);
  const tierRecords = records('Data Tier Sekolah');
  const tierSchoolCounts = new Map();
  for (const record of tierRecords) tierSchoolCounts.set(record.schoolId, (tierSchoolCounts.get(record.schoolId) ?? 0) + 1);
  const seenTierSchools = new Set();
  result.tiers = tierRecords.flatMap((record) => {
    const { schoolId, source } = record;
    if (!validReference(record)) return [];
    const duplicate = tierSchoolCounts.get(schoolId) > 1;
    if (duplicate) issue(record, 'DUPLICATE_TIER_ROW', 'ID Sekolah', 'Baris tier sekolah ganda; penilaian dianggap tidak valid.');
    if (seenTierSchools.has(schoolId)) return [];
    seenTierSchools.add(schoolId);
    const row = workbook['Data Tier Sekolah'][source.row - 1];
    return tierColumns.map((column) => {
      const value = text(row[column.index]);
      const badValue = Boolean(value && !['Tier 1', 'Tier 2', 'Tier 3'].includes(value));
      const invalid = duplicate || badValue;
      if (badValue) issue(record, 'INVALID_TIER', `Tier ${column.year}`, 'Nilai tier tidak dikenali; bukan tier kosong.');
      return { schoolId, year: column.year, tier: invalid ? null : value || null, ...(invalid ? { invalid: true } : {}), source };
    });
  });
  const visitRecords = records('Riwayat Kunjungan');
  const visitIdCounts = new Map();
  for (const visit of visitRecords) {
    if (visit.id) visitIdCounts.set(visit.id, (visitIdCounts.get(visit.id) ?? 0) + 1);
  }
  const seenVisits = new Set();
  result.visits = visitRecords.flatMap((visit) => {
    if (visitIdCounts.get(visit.id) > 1) issue(visit, 'DUPLICATE_VISIT_ID', 'ID Visit', 'ID kunjungan ganda; hanya kunjungan valid pertama dihitung.', 'warning');
    if (!visit.id) {
      issue(visit, 'MISSING_REQUIRED_FIELD', 'ID Visit', 'ID kunjungan wajib belum diisi.');
      return [];
    }
    if (!validReference(visit)) return [];
    const date = parseDate(visit.date);
    if (!date) {
      issue(visit, 'INVALID_VISIT_DATE', 'Tanggal', 'Tanggal kunjungan tidak valid; kunjungan dikeluarkan.');
      return [];
    }
    const followUpDate = visit.followUpDate ? parseDate(visit.followUpDate) : null;
    const invalidFollowUpDate = Boolean(visit.followUpDate && !followUpDate);
    if (invalidFollowUpDate) issue(visit, 'INVALID_FOLLOW_UP_DATE', 'Tanggal Follow-up', 'Tanggal tindak lanjut tidak valid.');
    const knownStatuses = { 'belum selesai': 'Belum Selesai', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
    const statusKey = visit.followUpStatus.toLowerCase();
    const followUpStatus = Object.hasOwn(knownStatuses, statusKey) ? knownStatuses[statusKey] : visit.followUpStatus;
    if (!followUpStatus && (visit.nextAction || visit.followUpDate)) issue(visit, 'MISSING_FOLLOW_UP_STATUS', 'Status Follow-up', 'Status tindak lanjut belum diisi.', 'warning');
    else if (followUpStatus && !Object.values(knownStatuses).includes(followUpStatus)) issue(visit, 'UNKNOWN_FOLLOW_UP_STATUS', 'Status Follow-up', 'Status tindak lanjut tidak dikenali.', 'warning');
    if (seenVisits.has(visit.id)) return [];
    seenVisits.add(visit.id);
    return [{
      ...visit, date, activities: [...new Set(visit.activities.split(/[,;\n|]/).map(text).filter(Boolean))], followUpDate, followUpStatus,
      ...(invalidFollowUpDate ? { invalidFollowUpDate: true } : {}),
    }];
  });
  for (const visit of result.visits) {
    const school = schoolsById.get(visit.schoolId);
    if (school && (!school.lastVisitDate || visit.date > school.lastVisitDate)) school.lastVisitDate = visit.date;
  }
  return result;
}
