import { Building2, CalendarDays, Flag, Clock3, ArrowUpRight, ArrowRight, MapPin, Info } from 'lucide-react';
import { dashboardSummary, filterSchools, filterVisits, classifyFollowUp } from '../../../shared/selectors.mjs';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { countBy, monthlyVisits } from '../../utils/presentation.mjs';
import { number, formatDate } from '../../utils/format.mjs';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Filters from '../../components/shared/Filters.jsx';
import { TierDonut, MonthlyTrend, HorizontalBars, PanelHeader } from '../../components/shared/Charts.jsx';
import VisitTable from '../../components/shared/VisitTable.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import { FollowUpBadge } from '../../components/shared/Badge.jsx';
export default function DashboardPage() {
  const { data, filters, href, today } = useDashboard();
  const summary = dashboardSummary(data, { ...filters, today });
  const schools = filterSchools(data, filters);
  const schoolIds = schools.map(s => s.id);
  const visits = filterVisits(data, { ...filters, schoolIds }).sort((a, b) => b.date.localeCompare(a.date));
  const schoolMap = new Map(data.schools.map(s => [s.id, s]));
  const followUps = filterVisits(data, { schoolIds, marketer: filters.marketer });
  const overdue = followUps.filter(v => classifyFollowUp(v, today) === 'overdue').sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
  const tierItems = [
    { key: 'Tier 1', label: 'Tier 1', value: summary.tier1, color: '#06509B' },
    { key: 'Tier 2', label: 'Tier 2', value: summary.tier2, color: '#64A7D1' },
    { key: 'Tier 3', label: 'Tier 3', value: summary.tier3, color: '#F1D043' },
    { key: 'unassessed', label: 'Belum dinilai', value: summary.unassessed, color: '#D9DFE7' },
    { key: 'invalid', label: 'Tidak valid', value: summary.invalidTier, color: '#C67575' },
  ].map(item => ({ ...item, href: href('schools', { tier: item.key }) }));
  const regions = countBy(schools, s => s.region).map(item => ({ ...item, href: item.label === 'Belum diisi' ? undefined : href('schools', { region: item.label }) }));
  const marketers = countBy(visits, v => v.marketer).map(item => ({ ...item, href: item.label === 'Belum diisi' ? undefined : href('visits', { marketer: item.label }) }));
  return <div data-testid="page-dashboard" className="page-view dashboard-page">
    <PageHeader title="Ringkasan marketing" description="Gambaran relasi sekolah, aktivitas tim, dan tindak lanjut yang perlu perhatian."/>
    <Filters/>
    <div className="section-caption"><span>IKHTISAR KINERJA</span><span><CalendarDays size={13}/>{filters.start ? `${formatDate(filters.start)} – ${filters.end ? formatDate(filters.end) : 'seterusnya'}` : 'Seluruh rentang aktivitas'}</span></div>
    <div className="kpi-grid">
      <a data-testid="kpi-schools" className="kpi-card" href={href('schools')}><div className="kpi-top"><span className="kpi-icon icon-blue"><Building2 size={20}/></span><ArrowUpRight size={16}/></div><span className="kpi-label">Total sekolah</span><strong className="kpi-value">{number(summary.totalSchools)}</strong><span className="kpi-foot"><span className="tiny-dot green"/><strong>{number(summary.activeSchools)}</strong> sekolah aktif</span></a>
      <a data-testid="kpi-visits" className="kpi-card" href={href('visits')}><div className="kpi-top"><span className="kpi-icon icon-teal"><CalendarDays size={20}/></span><ArrowUpRight size={16}/></div><span className="kpi-label">Kunjungan marketing</span><strong className="kpi-value">{number(summary.visits)}</strong><span className="kpi-foot">Menjangkau <strong>{number(summary.visitedSchools)}</strong> sekolah unik</span></a>
      <a data-testid="kpi-today" className="kpi-card" href={href('follow-ups', { group: 'today' })}><div className="kpi-top"><span className="kpi-icon icon-gold"><Flag size={20}/></span><ArrowUpRight size={16}/></div><span className="kpi-label">Follow-up hari ini</span><strong className="kpi-value">{number(summary.followUpToday)}</strong><span className="kpi-foot">Agenda <strong>{formatDate(today)}</strong></span></a>
      <a data-testid="kpi-overdue" className="kpi-card kpi-overdue" href={href('follow-ups', { group: 'overdue' })}><div className="kpi-top"><span className="kpi-icon icon-red"><Clock3 size={20}/></span><ArrowUpRight size={16}/></div><span className="kpi-label">Follow-up terlambat</span><strong className="kpi-value">{number(summary.followUpOverdue)}</strong><span className="kpi-foot"><span className="tiny-dot red"/>{summary.followUpOverdue ? 'Perlu ditindaklanjuti tim' : 'Tidak ada agenda terlambat'}</span></a>
    </div>
    <div className="primary-chart-grid">
      <section className="surface-card tier-overview"><PanelHeader title="Sebaran tier sekolah" subtitle={`Penilaian tahunan · ${filters.year || 'tahun belum tersedia'}`} href={href('tiers')} action="Detail tier"/><TierDonut items={tierItems} total={summary.totalSchools} year={filters.year}/><div className="panel-footnote"><Info size={13}/> Tier dibaca dari sumber, bukan penilaian otomatis.</div></section>
      <section className="surface-card trend-overview"><PanelHeader title="Tren kunjungan" subtitle="Aktivitas marketing per bulan" href={href('visits')} action="Lihat riwayat"/><div className="trend-total"><strong>{number(summary.visits)}</strong><span>kunjungan pada periode terpilih</span><span className="chart-key"><span/> Kunjungan</span></div><MonthlyTrend series={monthlyVisits(visits, filters.start, filters.end, today)} total={summary.visits}/></section>
    </div>
    <div className="secondary-chart-grid"><section className="surface-card"><PanelHeader title="Sebaran sekolah" subtitle="Berdasarkan daerah · mengikuti filter sekolah" href={href('schools')}/><HorizontalBars items={regions} unit="sekolah" maxRows={6}/></section><section className="surface-card"><PanelHeader title="Aktivitas tim marketing" subtitle="Berdasarkan marketing pelaksana · periode terpilih" href={href('visits')}/><HorizontalBars items={marketers} unit="visit" color="gold" maxRows={6}/></section></div>
    <section className="surface-card action-queue"><PanelHeader title="Prioritas tindak lanjut" subtitle="Agenda terlambat, diurutkan dari yang paling awal" href={href('follow-ups', { group: 'overdue' })} action="Lihat semua agenda"/>{overdue.length ? <div className="queue-list">{overdue.slice(0, 3).map(visit => <a className="queue-row" href={href('visits', { visit: visit.id, schoolId: visit.schoolId, preset: 'all', start: undefined, end: undefined })} key={visit.id}><span className="queue-icon"><Flag size={17}/></span><div className="queue-school"><strong>{schoolMap.get(visit.schoolId)?.name || visit.schoolId}</strong><span>{visit.nextAction || 'Tindak lanjut belum dirinci'}</span></div><span className="queue-marketer">{visit.marketer || 'Pelaksana belum diisi'}</span><div className="queue-date"><strong>{formatDate(visit.followUpDate)}</strong><FollowUpBadge group="overdue"/></div><ArrowUpRight size={16}/></a>)}</div> : <EmptyState compact title="Tidak ada tindak lanjut terlambat" description="Agenda yang terlambat pada filter terpilih akan tampil di sini."/>}<div className="panel-footnote"><Clock3 size={13}/> Follow-up dihitung lintas waktu. Tidak dibatasi tanggal kunjungan.</div></section>
    <section className="surface-card recent-visits"><PanelHeader title="Kunjungan terbaru" subtitle="Catatan aktivitas terbaru sesuai filter Anda" href={href('visits')} action="Semua kunjungan"/><VisitTable visits={visits.slice(0, 5)} compact/></section>
  </div>;
}
