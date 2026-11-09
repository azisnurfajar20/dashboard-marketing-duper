import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Building2, Layers, CalendarDays, Flag, Database, UserRoundCog, Menu, X, Search, LogOut, ChevronRight, ExternalLink, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { initials, spreadsheetHref, formatTimestamp } from '../../utils/format.mjs';
import Brand from './Brand.jsx';
const navigation = [
  { label: 'Ringkasan', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Data sekolah', page: 'schools', icon: Building2 },
  { label: 'Tier sekolah', page: 'tiers', icon: Layers },
  { label: 'Riwayat kunjungan', page: 'visits', icon: CalendarDays },
  { label: 'Follow-up', page: 'follow-ups', icon: Flag },
  { label: 'Status data', page: 'data-status', icon: Database },
  { label: 'Pengaturan akun', page: 'account', icon: UserRoundCog },
];
export default function AppLayout({ children, page, user, status, onLogout, logoutDisabled = false }) {
  const { href, filters } = useDashboard();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1100);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)');
    const update = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [search, setSearch] = useState('');
  const panel = useRef(null);
  const trigger = useRef(null);
  const main = useRef(null);
  const previous = useRef(page);
  const activePage = page === 'school-detail' ? 'schools' : page;
  const current = navigation.find(n => n.page === activePage);
  const sourceUrl = spreadsheetHref(status?.spreadsheetUrl);
  useEffect(() => { setOpen(false); if (previous.current !== page) { main.current?.focus(); previous.current = page; } }, [page]);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab') {
        const elements = [...panel.current.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const resize = () => { if (window.innerWidth >= 1100) setOpen(false); };
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', keydown); window.removeEventListener('resize', resize); trigger.current?.focus(); };
  }, [open]);
  const navHref = destination => href(destination, { search: undefined, status: undefined, tier: undefined, group: undefined, change: undefined, schoolId: undefined, sort: undefined });
  const submitSearch = event => { event.preventDefault(); window.location.hash = href('schools', { search: search.trim(), page: undefined }); setSearch(''); };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Lewati ke konten</a>
    {open && <button className="sidebar-backdrop" aria-label="Tutup menu navigasi" onClick={() => setOpen(false)}/>}
    <aside ref={panel} id="app-sidebar" inert={(mobile && !open) || undefined} aria-hidden={(mobile && !open) || undefined} className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Navigasi utama" role={open ? 'dialog' : undefined} aria-modal={open || undefined}>
      <div className="sidebar-brand"><Brand/><button className="icon-button sidebar-close" aria-label="Tutup navigasi" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <div className="workspace-name"><span className="workspace-dot"/> Marketing Offline<span className="workspace-version">V1</span></div>
      <div className="nav-group-label">RUANG KERJA</div>
      <nav>{navigation.slice(0, 5).map(({ label, page: destination, icon: Icon }) => <a key={destination} className={`nav-item-link ${activePage === destination ? 'active' : ''}`} href={navHref(destination)} aria-current={activePage === destination ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={19}/><span>{label}</span>{activePage === destination && <span className="nav-active-dot"/>}</a>)}</nav>
      <div className="nav-group-label data-nav-label">PENGELOLAAN</div>
      <nav><a className={`nav-item-link ${activePage === 'data-status' ? 'active' : ''}`} href={navHref('data-status')} aria-current={activePage === 'data-status' ? 'page' : undefined} onClick={() => setOpen(false)}><Database size={19}/><span>Status data</span><span className={`connection-dot ${status?.connection === 'error' ? 'error' : ''}`}/></a><a className={`nav-item-link ${activePage === 'account' ? 'active' : ''}`} href="#/account" aria-current={activePage === 'account' ? 'page' : undefined} onClick={() => setOpen(false)}><UserRoundCog size={19}/><span>Pengaturan akun</span>{activePage === 'account' && <span className="nav-active-dot"/>}</a></nav>
      <div className="sidebar-bottom">
        <div className="source-note"><span className="source-note-icon"><ShieldCheck size={19}/></span><strong>Satu sumber, satu acuan.</strong><p>Dashboard hanya membaca data. Perubahan dilakukan di Google Sheets.</p>{sourceUrl && status?.mode !== 'demo' ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Buka Google Sheets <ExternalLink size={13}/></a> : <a href={navHref('data-status')} onClick={() => setOpen(false)}>Lihat informasi sumber <ArrowUpRight size={14}/></a>}</div>
        <div className="sidebar-footer"><span className="connection-dot"/>{status?.mode === 'demo' ? 'Lingkungan demo' : 'Akses internal terlindungi'}<span className="footer-version">v1.0</span></div>
      </div>
    </aside>
    <div className="app-workspace" inert={open || undefined}>
      <header className="topbar">
        <button ref={trigger} className="icon-button mobile-menu" aria-label="Buka menu navigasi" aria-controls="app-sidebar" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21}/></button>
        <div className="mobile-topbar-brand"><Brand/></div>
        <div className="breadcrumb-line"><span>Ruang kerja</span><ChevronRight size={14}/><strong>{current?.label || 'Ringkasan'}</strong>{page === 'school-detail' && <><ChevronRight size={14}/><span>Detail sekolah</span></>}</div>
        <form className="topbar-search" role="search" onSubmit={submitSearch}><Search size={16}/><input type="search" aria-label="Cari sekolah di seluruh data" placeholder="Cari sekolah atau ID…" value={search} onChange={e => setSearch(e.target.value)}/><button aria-label="Jalankan pencarian sekolah" type="submit"><span aria-hidden="true">↵</span></button></form>
        <div className="topbar-divider"/>
        <div className="user-profile"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><span>{user.role || 'Tim marketing'}</span></div></div>
        <button className="icon-button logout-button" title="Keluar" aria-label="Keluar" onClick={onLogout} disabled={logoutDisabled}><LogOut size={18}/></button>
      </header>
      <main ref={main} tabIndex={-1} id="main-content" className="main-content">{children}</main>
      <footer className="workspace-footer"><span>© LPK Duta Persada Yogyakarta <span className="footer-separator">/</span> Monitor marketing</span><span title={formatTimestamp(status?.lastSuccessAt)}>Zona waktu Asia/Jakarta · WIB</span></footer>
    </div>
  </div>;
}
