import { useId } from 'react';
import { Search, SlidersHorizontal, RotateCcw, CalendarDays, Layers } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { uniqueOptions } from '../../utils/presentation.mjs';
import { presetRange } from '../../utils/format.mjs';
export function SelectField({ label, value = '', onChange, options, placeholder = 'Semua', testId, className = '' }) {
  const id = useId();
  return <div className={`filter-field ${className}`}><label htmlFor={id}>{label}</label><select id={id} className="form-select" value={value} onChange={event => onChange(event.target.value)} data-testid={testId}>{placeholder !== null && <option value="">{placeholder}</option>}{options.map(option => typeof option === 'object' ? <option key={option.value} value={option.value}>{option.label}</option> : <option key={option} value={option}>{option}</option>)}</select></div>;
}
export default function Filters({ variant = 'dashboard' }) {
  const { data, filters, updateFilters, today } = useDashboard();
  const withYear = ['dashboard', 'schools'].includes(variant);
  const withDates = ['dashboard', 'visits'].includes(variant);
  const withMarketer = ['dashboard', 'visits', 'follow-ups'].includes(variant);
  const withSchool = ['visits', 'follow-ups'].includes(variant);
  const id = useId();
  const change = key => value => updateFilters({ [key]: value });
  const reset = () => updateFilters(Object.fromEntries(['search', 'region', 'owner', 'status', 'tier', 'year', 'start', 'end', 'preset', 'schoolId', 'marketer', 'activity', 'sort', 'group', 'change'].map(key => [key, undefined])));
  const applyPreset = preset => updateFilters({ preset, ...presetRange(preset, today) });
  return <section className={`filter-card filter-${variant}`} aria-label="Filter data">
    <div className="filter-card-label"><span><SlidersHorizontal size={14}/> FILTER DATA</span><button type="button" className="text-button" onClick={reset}><RotateCcw size={12}/> Atur ulang</button></div>
    {(withYear || withDates) && <div className="filter-time-row">{withYear && <div className="year-filter"><SelectField label="Tahun tier" value={filters.year} onChange={change('year')} options={[...data.years].sort((a, b) => b - a)} placeholder={data.years.length ? null : 'Belum ada tahun'} testId="tier-year"/><span className="field-note">Penilaian sekolah</span></div>}{withDates && <div className="activity-date-filter"><SelectField label="Tanggal aktivitas" value={filters.preset} onChange={applyPreset} options={[{ value: 'year', label: 'Tahun berjalan' }, { value: 'month', label: 'Bulan ini' }, { value: 'last30', label: '30 hari terakhir' }, { value: 'all', label: 'Semua waktu' }, { value: 'custom', label: 'Rentang khusus' }]} placeholder={null}/><div className="filter-field"><label htmlFor={`${id}-start`}>Dari tanggal</label><input className="form-control" id={`${id}-start`} type="date" value={filters.start || ''} max={filters.end || undefined} onChange={event => updateFilters({ start: event.target.value, preset: 'custom' })}/></div><span className="date-range-dash" aria-hidden="true">—</span><div className="filter-field"><label htmlFor={`${id}-end`}>Sampai tanggal</label><input className="form-control" id={`${id}-end`} type="date" value={filters.end || ''} min={filters.start || undefined} onChange={event => updateFilters({ end: event.target.value, preset: 'custom' })}/></div><span className="field-note activity-note">Hanya menghitung kunjungan</span></div>}</div>}
    <div className="filter-details-row">
      {variant === 'schools' && <div className="filter-field school-search"><label htmlFor={`${id}-search`}>Cari sekolah</label><div className="input-with-icon"><Search size={16}/><input id={`${id}-search`} type="search" className="form-control" placeholder="Nama atau ID sekolah…" value={filters.search || ''} onChange={event => updateFilters({ search: event.target.value })}/></div></div>}
      <SelectField label="Daerah" value={filters.region} onChange={change('region')} options={uniqueOptions(data.schools, 'region')} placeholder="Semua daerah"/>
      <SelectField label="Marketing penanggung jawab" value={filters.owner} onChange={change('owner')} options={uniqueOptions(data.schools, 'owner')} placeholder="Semua penanggung jawab"/>
      {variant === 'schools' && <><SelectField label="Status sekolah" value={filters.status} onChange={change('status')} options={uniqueOptions(data.schools, 'status')} placeholder="Semua status"/><SelectField label="Tier sekolah" value={filters.tier} onChange={change('tier')} options={['Tier 1', 'Tier 2', 'Tier 3', { value: 'unassessed', label: 'Belum dinilai' }, { value: 'invalid', label: 'Tier tidak valid' }]} placeholder="Semua tier"/></>}
      {withMarketer && <SelectField label="Marketing pelaksana" value={filters.marketer} onChange={change('marketer')} options={uniqueOptions(data.visits, 'marketer')} placeholder="Semua pelaksana"/>}
      {withSchool && <SelectField label="Sekolah" value={filters.schoolId} onChange={change('schoolId')} options={data.schools.map(school => ({ value: school.id, label: `${school.name} · ${school.id}` }))} placeholder="Semua sekolah"/>}
      {variant === 'visits' && <SelectField label="Kegiatan" value={filters.activity} onChange={change('activity')} options={[...new Set(data.visits.flatMap(v => v.activities))].sort()} placeholder="Semua kegiatan"/>}
    </div>
    {withDates && filters.start && filters.end && filters.start > filters.end && <p className="filter-error" role="alert">Tanggal awal harus sebelum atau sama dengan tanggal akhir.</p>}
    {variant === 'follow-ups' && <p className="filter-explanation">Tindak lanjut dihitung lintas waktu berdasarkan tanggal follow-up di Asia/Jakarta. Rentang tanggal kunjungan tidak membatasi daftar ini.</p>}
  </section>;
}
