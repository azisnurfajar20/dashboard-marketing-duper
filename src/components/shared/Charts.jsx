import { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { number } from '../../utils/format.mjs';
import EmptyState from './EmptyState.jsx';
export function PanelHeader({ title, subtitle, href, action = 'Lihat semua', children }) {
  return <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}{href && <a className="panel-link" href={href}>{action}<ArrowUpRight size={14}/></a>}</div>;
}
export function TierDonut({ items, total, year }) {
  const id = useId();
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="tier-chart-content"><div className="donut-wrap"><svg viewBox="0 0 164 164" role="img" aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>{`Sebaran tier tahun ${year || 'belum tersedia'}`}</title><desc id={`${id}-desc`}>{items.map(item => `${item.label}: ${number(item.value)} sekolah`).join('. ')}. Total {number(total)} sekolah.</desc><circle cx="82" cy="82" r={radius} fill="none" stroke="#eef1f5" strokeWidth="18"/>{items.filter(x => x.value > 0).map(item => {
    const length = total ? item.value / total * circumference : 0;
    const current = offset; offset += length;
    return <circle key={item.key} cx="82" cy="82" r={radius} fill="none" stroke={item.color} strokeWidth="18" strokeDasharray={`${Math.max(0, length - 2.5)} ${circumference}`} strokeDashoffset={-current} transform="rotate(-90 82 82)"/>;
  })}<text x="82" y="81" textAnchor="middle" className="donut-total">{number(total)}</text><text x="82" y="100" textAnchor="middle" className="donut-caption">sekolah</text></svg></div><div className="tier-legend">{items.map(item => <a href={item.href} className="tier-legend-item" key={item.key}><span className="legend-swatch" style={{ background: item.color }}/><span>{item.label}</span><strong>{number(item.value)}</strong><small>{total ? Math.round(item.value / total * 100) : 0}%</small></a>)}</div></div>;
}
export function MonthlyTrend({ series, total }) {
  const id = useId();
  if (!total) return <EmptyState compact title="Belum ada kunjungan pada periode ini" description="Ubah rentang tanggal atau periksa catatan kunjungan di sumber."/>;
  const width = 660, height = 190, left = 36, right = 16, top = 18, bottom = 30;
  const max = Math.max(1, ...series.map(x => x.value));
  const ceiling = Math.max(4, Math.ceil(max / 4) * 4);
  const plotW = width - left - right, plotH = height - top - bottom;
  const points = series.map((item, index) => [left + (series.length === 1 ? plotW / 2 : index / (series.length - 1) * plotW), top + plotH * (1 - item.value / ceiling)]);
  const line = points.map((p, index) => `${index ? 'L' : 'M'}${p.join(',')}`).join(' ');
  const area = `${line} L${points.at(-1)[0]},${top + plotH} L${points[0][0]},${top + plotH} Z`;
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>Tren kunjungan bulanan</title><desc id={`${id}-desc`}>{series.map(item => `${item.label}: ${item.value} kunjungan`).join('. ')}. Total {number(total)} kunjungan.</desc><defs><linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06509B" stopOpacity=".16"/><stop offset="100%" stopColor="#06509B" stopOpacity=".015"/></linearGradient></defs>{[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={top + plotH * tick / 4} y2={top + plotH * tick / 4} stroke="#e8edf3" strokeDasharray="3 5"/><text x={left - 10} y={top + plotH * tick / 4 + 4} textAnchor="end" className="chart-axis">{ceiling - ceiling * tick / 4}</text></g>)}<path d={area} fill={`url(#${id}-gradient)`}/><path d={line} fill="none" stroke="#06509B" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>{points.map((point, index) => <g key={series[index].key}><circle cx={point[0]} cy={point[1]} r="3.5" fill="#fff" stroke="#06509B" strokeWidth="2"/><title>{`${series[index].label}: ${series[index].value} kunjungan`}</title>{(index === 0 || index === series.length - 1 || index % Math.max(1, Math.ceil(series.length / 8)) === 0) && <text x={point[0]} y={height - 6} textAnchor="middle" className="chart-axis">{series[index].label}</text>}</g>)}</svg><div className="chart-legend"><span className="line-swatch"/>Jumlah kunjungan <span className="chart-period-note">Satu ID visit = satu kunjungan</span></div></div>;
}
export function HorizontalBars({ items, unit = 'sekolah', color = 'blue', maxRows }) {
  if (!items.length) return <EmptyState compact title="Belum ada data sesuai filter"/>;
  const max = Math.max(...items.map(x => x.value), 1);
  const shown = maxRows ? items.slice(0, maxRows) : items;
  return <div className={`horizontal-bars bar-${color}`} role="list" aria-label={`Jumlah ${unit} per kelompok`}>{shown.map(item => <div className="bar-row" key={item.label} role="listitem"><div className="bar-caption">{item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}<strong>{number(item.value)}<small> {unit}</small></strong></div><div className="bar-track" aria-hidden="true"><span style={{ width: `${item.value / max * 100}%` }}/></div></div>)}{maxRows && items.length > maxRows && <p className="chart-more-note">Menampilkan {maxRows} teratas dari {items.length} kelompok. Seluruh data tersedia di daftar terkait.</p>}</div>;
}
