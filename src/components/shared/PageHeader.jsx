import { RefreshCw, CalendarDays } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { formatDate, formatTimestamp } from '../../utils/format.mjs';
export default function PageHeader({ title, description, eyebrow, children, refresh = true }) {
  const { sync, syncing, status, today } = useDashboard();
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="page-heading-actions">{children}{refresh && <><div className="sync-caption"><span className={`connection-dot ${status?.error ? 'error' : ''}`}/><span>{status?.mode === 'demo' ? 'Sumber: demo fiktif' : 'Sinkronisasi terakhir'}<small>{formatTimestamp(status?.lastSuccessAt)}</small></span></div><button className="btn btn-white refresh-button" onClick={sync} disabled={syncing}><RefreshCw size={16} className={syncing ? 'spin' : ''}/>{syncing ? 'Memperbarui…' : 'Perbarui Data'}</button></>}</div></div>;
}
