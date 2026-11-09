export const FOLLOW_UP_LABELS = { overdue: 'Terlambat', today: 'Hari ini', upcoming: 'Mendatang', unscheduled: 'Belum dijadwalkan', completed: 'Selesai', cancelled: 'Dibatalkan', 'status-missing': 'Status belum diisi', invalid: 'Tanggal tidak valid', none: 'Tanpa tindak lanjut' };
const tierLabels = { unassessed: 'Belum dinilai', invalid: 'Tier tidak valid' };
export function TierBadge({ tier }) {
  const tone = tier === 'Tier 1' ? 'blue' : tier === 'Tier 2' ? 'teal' : tier === 'Tier 3' ? 'gold' : tier === 'invalid' ? 'red' : 'neutral';
  return <span className={`status-badge badge-${tone}`}><span className="badge-dot"/>{tierLabels[tier] || tier || 'Belum dinilai'}</span>;
}
export function FollowUpBadge({ group }) {
  const tone = group === 'overdue' || group === 'invalid' ? 'red' : group === 'today' ? 'gold' : group === 'completed' ? 'green' : group === 'upcoming' ? 'blue' : 'neutral';
  return <span className={`status-badge badge-${tone}`}><span className="badge-dot"/>{FOLLOW_UP_LABELS[group] || group}</span>;
}
export function SchoolStatusBadge({ status }) { return <span className={`status-badge ${String(status).toLowerCase() === 'aktif' ? 'badge-green' : 'badge-neutral'}`}><span className="badge-dot"/>{status || 'Status belum diisi'}</span>; }
