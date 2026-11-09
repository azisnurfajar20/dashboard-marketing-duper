import { ArrowUpRight, X, CalendarDays, Building2, UserRound, Flag, Info } from 'lucide-react';
import { filterVisits, filterSchools, classifyFollowUp } from '../../../shared/selectors.mjs';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { formatDate, number } from '../../utils/format.mjs';
import { paginate } from '../../utils/presentation.mjs';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Filters from '../../components/shared/Filters.jsx';
import VisitTable from '../../components/shared/VisitTable.jsx';
import { Pagination } from '../../components/shared/DataTable.jsx';
import { FollowUpBadge } from '../../components/shared/Badge.jsx';
export default function VisitsPage() {
  const { data, filters, href, today } = useDashboard();
  const schoolIds = filterSchools(data, filters).map(s => s.id);
  const visits = filterVisits(data, { ...filters, schoolIds }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const result = paginate(visits, filters.page, 10);
  const selected = filters.visit ? data.visits.find(visit => visit.id === filters.visit) : null;
  const selectedSchool = selected ? data.schools.find(s => s.id === selected.schoolId) : null;
  return <div data-testid="page-visits" className="page-view"><PageHeader title="Riwayat kunjungan" description="Telusuri kegiatan tim, hasil pertemuan, dan langkah berikutnya di setiap sekolah."/><Filters variant="visits"/>
    {filters.visit && <section className="surface-card visit-detail" aria-label="Detail kunjungan"><div className="panel-header"><div><span className="eyebrow">DETAIL KUNJUNGAN · {selected?.id || 'TIDAK DITEMUKAN'}</span><h2>{selectedSchool?.name || 'Catatan tidak ditemukan'}</h2></div><a className="icon-button" href={href('visits', { visit: undefined })} aria-label="Tutup detail kunjungan"><X size={18}/></a></div>{selected ? <><div className="visit-detail-meta"><span><CalendarDays size={15}/>{formatDate(selected.date)}</span><span><UserRound size={15}/>{selected.marketer || 'Pelaksana belum diisi'}</span><a href={href('schools', {}, selected.schoolId)}><Building2 size={15}/>Profil sekolah <ArrowUpRight size={13}/></a></div><div className="visit-detail-grid"><div><h3>Kegiatan</h3><div className="activity-tags">{selected.activities.map(activity => <span key={activity}>{activity}</span>)}</div><h3>PIC yang ditemui</h3><p>{selected.pic || 'Belum dicatat'}</p><h3>Hasil kunjungan</h3><p className="preserve-lines">{selected.result || 'Hasil kunjungan belum dicatat.'}</p></div><div className="visit-followup-block"><h3>Tindak lanjut</h3><FollowUpBadge group={classifyFollowUp(selected, today)}/><p className="preserve-lines">{selected.nextAction || 'Belum ada tindak lanjut dicatat.'}</p><dl><div><dt>Tanggal follow-up</dt><dd>{selected.invalidFollowUpDate ? 'Tanggal tidak valid' : formatDate(selected.followUpDate)}</dd></div><div><dt>Status sumber</dt><dd>{selected.followUpStatus || 'Status belum diisi'}</dd></div></dl><a className="panel-link" href={href('follow-ups', { schoolId: selected.schoolId, group: classifyFollowUp(selected, today) === 'none' ? undefined : classifyFollowUp(selected, today) })}>Lihat antrean follow-up <ArrowUpRight size={13}/></a></div></div><div className="panel-footnote">Sumber: {selected.source?.tab || 'Riwayat Kunjungan'} · baris {selected.source?.row || '—'}. Catatan hanya dapat diubah melalui Google Sheets.</div></> : <div className="inline-info"><Info size={16}/> ID kunjungan tidak tersedia pada data valid. Periksa alamat atau sumber data.</div>}</section>}
    <section className="surface-card"><div className="table-toolbar"><div><h2>Catatan kunjungan <span className="count-pill">{number(visits.length)}</span></h2><p><strong>{number(new Set(visits.map(v => v.schoolId)).size)}</strong> sekolah unik · diurutkan dari kunjungan terbaru</p></div><span className="subtle-label">Satu ID visit dihitung satu kali</span></div><VisitTable visits={result.rows}/><Pagination {...result} onPage={page => { window.location.hash = href('visits', { page }); }}/></section></div>;
}
