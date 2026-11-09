import { Building2, ArrowUpRight, UserRound, ExternalLink, Info } from 'lucide-react';
import { filterSchools } from '../../../shared/selectors.mjs';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { tierFor, paginate } from '../../utils/presentation.mjs';
import { number, formatDate, initials, spreadsheetHref } from '../../utils/format.mjs';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Filters, { SelectField } from '../../components/shared/Filters.jsx';
import DataTable, { Pagination } from '../../components/shared/DataTable.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import { TierBadge, SchoolStatusBadge } from '../../components/shared/Badge.jsx';
export default function SchoolsPage() {
  const { data, status, filters, updateFilters, href } = useDashboard();
  const schools = filterSchools(data, { ...filters, sort: filters.sort || 'name-asc' });
  const result = paginate(schools, filters.page, 10);
  const source = spreadsheetHref(status.spreadsheetUrl);
  const columns = [
    { key: 'name', label: 'Nama sekolah', render: school => <div className="school-name-wrap"><a className="school-name-cell" href={href('schools', {}, school.id)}><span className="school-icon"><Building2 size={17}/></span><span><strong>{school.name}</strong><small>{school.id} · {school.ownership || 'Kepemilikan belum diisi'}</small></span></a><a className="mobile-detail-link" aria-label={`Lihat detail ${school.name}`} href={href('schools', {}, school.id)}>Lihat detail <ArrowUpRight size={13}/></a></div> },
    { key: 'region', label: 'Daerah' },
    { key: 'owner', label: 'Marketing penanggung jawab', render: school => <span className="person-cell"><span className="mini-avatar">{initials(school.owner)}</span>{school.owner || 'Belum diisi'}</span> },
    { key: 'tier', label: `Tier ${filters.year || '—'}`, render: school => <TierBadge tier={tierFor(data, school.id, filters.year)}/> },
    { key: 'status', label: 'Status', render: school => <SchoolStatusBadge status={school.status}/> },
    { key: 'lastVisitDate', label: 'Kunjungan terakhir', render: school => <span className="date-cell">{formatDate(school.lastVisitDate)}</span> },
    { key: 'detail', label: 'Detail', render: school => <a className="table-detail-link" aria-label={`Detail ${school.name}`} href={href('schools', {}, school.id)}>Detail <ArrowUpRight size={13}/></a> },
  ];
  return <div data-testid="page-schools" className="page-view"><PageHeader title="Data sekolah" description="Temukan relasi sekolah, penanggung jawab, dan prioritas pendekatan tim."/><Filters variant="schools"/><section className="surface-card directory-card"><div className="table-toolbar"><div><h2>Direktori sekolah <span className="count-pill">{number(schools.length)}</span></h2><p>Tier mengikuti tahun penilaian, bukan tanggal kunjungan.</p></div><SelectField label="Urutkan sekolah" value={filters.sort || 'name-asc'} onChange={sort => updateFilters({ sort })} options={[{ value: 'name-asc', label: 'Nama A–Z' }, { value: 'name-desc', label: 'Nama Z–A' }, { value: 'last-visit', label: 'Kunjungan paling baru' }]} placeholder={null}/></div><DataTable caption="Direktori sekolah dan penanggung jawab marketing" columns={columns} rows={result.rows} empty={<EmptyState title="Tidak ada sekolah sesuai filter" description="Coba kata pencarian lain atau atur ulang filter. Data kosong tidak diganti data demo."/>}/><Pagination {...result} onPage={page => { window.location.hash = href('schools', { page }); }}/></section><div className="read-only-note"><Info size={16}/><span>Data dikelola di Google Sheets. Dashboard ini hanya untuk pemantauan.{status.mode === 'demo' && ' Saat ini Anda melihat data fiktif demo.'}</span>{source && status.mode !== 'demo' && <a href={source} target="_blank" rel="noopener noreferrer">Buka sumber <ExternalLink size={14}/></a>}</div></div>;
}
