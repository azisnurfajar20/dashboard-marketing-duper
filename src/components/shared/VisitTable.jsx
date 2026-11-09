import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { formatDate, initials } from '../../utils/format.mjs';
import { classifyFollowUp } from '../../../shared/selectors.mjs';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';
import { FollowUpBadge } from './Badge.jsx';
export default function VisitTable({ visits, compact = false }) {
  const { data, href, today } = useDashboard();
  const schoolMap = new Map(data.schools.map(s => [s.id, s]));
  const columns = [
    { key: 'date', label: 'Tanggal', render: v => <span className="date-cell">{formatDate(v.date)}<small>{v.id}</small></span> },
    { key: 'school', label: 'Sekolah', render: v => <a className="school-cell" href={href('schools', {}, v.schoolId)}><strong>{schoolMap.get(v.schoolId)?.name || v.schoolId}</strong><small>{schoolMap.get(v.schoolId)?.region || 'Daerah belum diisi'}</small></a> },
    { key: 'marketer', label: 'Marketing pelaksana', render: v => <span className="person-cell"><span className="mini-avatar">{initials(v.marketer)}</span>{v.marketer || 'Belum diisi'}</span> },
    { key: 'activities', label: 'Kegiatan', render: v => <div className="activity-tags">{v.activities.map(activity => <span key={activity}>{activity}</span>)}</div> },
    ...(!compact ? [{ key: 'result', label: 'Hasil kunjungan', className: 'result-column', render: v => <span className="result-preview">{v.result || 'Belum ada hasil dicatat'}</span> }, { key: 'followUp', label: 'Follow-up', render: v => <FollowUpBadge group={classifyFollowUp(v, today)}/> }] : []),
    { key: 'detail', label: 'Detail', render: v => <a className="table-detail-link" href={href('visits', { visit: v.id, schoolId: v.schoolId })} aria-label={`Detail kunjungan ${v.id}`}>Detail <ArrowUpRight size={13}/></a> },
  ];
  return <DataTable caption="Daftar riwayat kunjungan marketing" columns={columns} rows={visits} empty={<EmptyState compact title="Belum ada kunjungan pada periode ini" description="Catatan yang sesuai filter akan tampil di sini."/>}/>;
}
