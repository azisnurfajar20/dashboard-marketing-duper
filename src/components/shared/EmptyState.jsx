import { SearchX } from 'lucide-react';
export default function EmptyState({ title = 'Belum ada data yang sesuai', description = 'Coba ubah filter atau periksa kelengkapan data di sumber.', children, compact = false }) {
  return <div className={`empty-state ${compact ? 'compact' : ''}`}><span className="empty-icon"><SearchX size={23}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}
