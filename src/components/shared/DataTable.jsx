import { ChevronLeft, ChevronRight } from 'lucide-react';
import { number } from '../../utils/format.mjs';
export default function DataTable({ caption, columns, rows, rowKey = 'id', empty, className = '' }) {
  return <div className={`table-scroll ${className}`} role="region" aria-label={caption} tabIndex={0}><table className="table data-table"><caption className="visually-hidden">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" className={column.className || ''}>{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row[rowKey] || index}>{columns.map(column => <td key={column.key} className={column.className || ''}>{column.render ? column.render(row) : row[column.key] || '—'}</td>)}</tr>) : <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>;
}
export function Pagination({ page, pages, total, from, to, onPage }) {
  return <div className="pagination-bar"><span>Menampilkan <strong>{number(from)}–{number(to)}</strong> dari <strong>{number(total)}</strong> data</span><div><button className="icon-button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16}/></button><span className="page-count">{page} <span>/ {pages}</span></span><button className="icon-button" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16}/></button></div></div>;
}
