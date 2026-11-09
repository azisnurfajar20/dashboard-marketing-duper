import { ArrowUpRight, Flag, CalendarDays } from 'lucide-react';
import { filterSchools, filterVisits, classifyFollowUp } from '../../../shared/selectors.mjs';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { number, formatDate } from '../../utils/format.mjs';
import { paginate } from '../../utils/presentation.mjs';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Filters from '../../components/shared/Filters.jsx';
import DataTable, { Pagination } from '../../components/shared/DataTable.jsx';
import { FollowUpBadge, FOLLOW_UP_LABELS } from '../../components/shared/Badge.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
const groups = ['overdue', 'today', 'upcoming', 'unscheduled', 'completed', 'cancelled', 'status-missing', 'invalid'];
const descriptions = { overdue: 'Tindak lanjut belum selesai dengan tanggal sebelum hari ini.', today: 'Tindak lanjut yang dijadwalkan hari ini dalam zona waktu Jakarta.', upcoming: 'Tindak lanjut dengan tanggal setelah hari ini.', unscheduled: 'Tindak lanjut terbuka yang belum memiliki jadwal.', completed: 'Catatan yang sudah ditandai selesai di sumber.', cancelled: 'Catatan yang ditandai dibatalkan di sumber.', 'status-missing': 'Status kosong atau belum dikenali. Tidak dianggap selesai.', invalid: 'Tanggal follow-up tidak valid. Tidak dipindahkan ke belum dijadwalkan.' };
export default function FollowUpsPage() {
  const { data, filters, updateFilters, href, today } = useDashboard();
  const schoolIds = filterSchools(data, filters).map(s => s.id);
  const visits = filterVisits(data, { schoolIds, schoolId: filters.schoolId, marketer: filters.marketer });
  const buckets = Object.fromEntries(groups.map(group => [group, []]));
  for (const visit of visits) { const group = classifyFollowUp(visit, today); if (buckets[group]) buckets[group].push(visit); }
  const group = groups.includes(filters.group) ? filters.group : 'overdue';
  const selected = buckets[group].sort((a, b) => (a.followUpDate || '9999').localeCompare(b.followUpDate || '9999') || a.id.localeCompare(b.id));
  const result = paginate(selected, filters.page, 10);
  const schoolMap = new Map(data.schools.map(s => [s.id, s]));
  return <div data-testid="page-follow-ups" className="page-view"><PageHeader title="Follow-up" description="Prioritaskan langkah berikutnya. Semua perubahan status dilakukan di sumber data."/><Filters variant="follow-ups"/><div className="followup-context"><CalendarDays size={15}/><span>Acuan hari ini: <strong>{formatDate(today)}</strong> · Asia/Jakarta</span><span className="subtle-label">Tanpa pengiriman atau perubahan otomatis</span></div><section className="surface-card followup-card"><div className="followup-tabs" role="group" aria-label="Kelompok tindak lanjut">{groups.map(key => <button key={key} className={group === key ? 'active' : ''} aria-pressed={group === key} onClick={() => updateFilters({ group: key })}>{FOLLOW_UP_LABELS[key]}<span>{number(buckets[key].length)}</span></button>)}</div><div className="table-toolbar"><div><h2><Flag size={18}/>{FOLLOW_UP_LABELS[group]} <span className="count-pill">{number(selected.length)}</span></h2><p>{descriptions[group]}</p></div></div><DataTable caption={`Tindak lanjut ${FOLLOW_UP_LABELS[group]}`} rows={result.rows} columns={[{ key: 'school', label: 'Sekolah', render: visit => <a className="school-cell" href={href('schools', {}, visit.schoolId)}><strong>{schoolMap.get(visit.schoolId)?.name || visit.schoolId}</strong><small>{schoolMap.get(visit.schoolId)?.region || 'Daerah belum diisi'}</small></a> }, { key: 'nextAction', label: 'Tindak lanjut', className: 'action-column', render: visit => <span className="result-preview">{visit.nextAction || 'Tindak lanjut belum dirinci'}</span> }, { key: 'marketer', label: 'Marketing pelaksana' }, { key: 'followUpDate', label: 'Tanggal follow-up', render: visit => <span className="date-cell">{visit.invalidFollowUpDate ? 'Tidak valid' : visit.followUpDate ? formatDate(visit.followUpDate) : 'Belum dijadwalkan'}</span> }, { key: 'status', label: 'Status', render: () => <FollowUpBadge group={group}/> }, { key: 'detail', label: 'Detail', render: visit => <a className="table-detail-link" href={href('visits', { visit: visit.id, schoolId: visit.schoolId, preset: 'all', start: undefined, end: undefined })} aria-label={`Detail tindak lanjut ${visit.id}`}>Detail <ArrowUpRight size={13}/></a> }]} empty={<EmptyState title={`Tidak ada agenda ${FOLLOW_UP_LABELS[group].toLowerCase()}`} description="Tidak ada catatan yang memenuhi kelompok dan filter terpilih. Catatan tanpa tindakan dan tanpa status tidak ditampilkan sebagai agenda."/>}/><Pagination {...result} onPage={page => { window.location.hash = href('follow-ups', { page }); }}/></section></div>;
}
