import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from './services/api/client.js';
import { parseRoute, routeHref } from './utils/routes.mjs';
import { presetRange } from './utils/format.mjs';
import { jakartaToday } from '../shared/selectors.mjs';
import { DashboardContext } from './context/DashboardContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import SchoolsPage from './pages/schools/SchoolsPage.jsx';
import SchoolDetailPage from './pages/schools/SchoolDetailPage.jsx';
import TiersPage from './pages/tiers/TiersPage.jsx';
import VisitsPage from './pages/visits/VisitsPage.jsx';
import FollowUpsPage from './pages/follow-ups/FollowUpsPage.jsx';
import DataStatusPage from './pages/data-status/DataStatusPage.jsx';
import AccountPage from './pages/account/AccountPage.jsx';

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [payload, setPayload] = useState(null);
  const [diagnosticStatus, setDiagnosticStatus] = useState(null);
  const [dataError, setDataError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loginNotice, setLoginNotice] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [accountUpdating, setAccountUpdating] = useState(false);
  const accountMutationPending = useRef(false);
  const authenticationActionPending = useRef(false);
  const authGeneration = useRef(0);
  const today = jakartaToday();

  useEffect(() => {
    const change = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  const checkSession = useCallback(async () => {
    const generation = ++authGeneration.current;
    setSessionError('');
    try {
      const session = await api.session();
      if (generation !== authGeneration.current) return null;
      setUser(session.user);
      setDemoAvailable(session.demoAvailable === true);
      if (!session.user) { setPayload(null); setDiagnosticStatus(null); setDataError(''); setLoading(false); setSyncing(false); window.location.hash = '#/login'; }
      else if (!window.location.hash || parseRoute(window.location.hash).page === 'login') window.location.hash = '#/dashboard';
      setSessionChecked(true);
      return session.user;
    } catch (error) { if (generation !== authGeneration.current) return null; setSessionError(error.message); setSessionChecked(true); return null; }
  }, []);
  useEffect(() => { checkSession(); }, [checkSession]);

  const handleFailure = useCallback(error => {
    if (error.code === 'AUTH_REQUIRED') {
      authGeneration.current++;
      setPayload(null); setDiagnosticStatus(null); setUser(null); setNotice(null); setDataError('');
      setLoading(false); setSyncing(false);
      window.location.hash = '#/login';
      return;
    }
    if (error.payload?.status) setDiagnosticStatus(error.payload.status);
    setDataError(error.message);
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    const generation = authGeneration.current;
    if (!quiet) setLoading(true);
    try { const result = await api.data(); if (generation !== authGeneration.current) return; setPayload(result); setDiagnosticStatus(null); setDataError(''); }
    catch (error) { if (generation === authGeneration.current) handleFailure(error); }
    finally { if (generation === authGeneration.current) setLoading(false); }
  }, [handleFailure]);
  useEffect(() => {
    if (!user) return;
    loadData();
    const timer = setInterval(() => loadData(true), 60000);
    return () => clearInterval(timer);
  }, [user, loadData]);

  const sync = async () => {
    if (syncing) return;
    const generation = authGeneration.current;
    setSyncing(true); setNotice(null);
    try {
      const result = await api.sync();
      if (generation !== authGeneration.current) return;
      setPayload(result); setDiagnosticStatus(null); setDataError('');
      setNotice(result.status.error ? { type: 'danger', text: result.status.error } : { type: 'success', text: result.status.mode === 'demo' ? 'Data fiktif demo telah dimuat ulang. Tidak terhubung ke Google Sheets.' : 'Data berhasil diperbarui dari sumber.' });
    } catch (error) {
      if (generation !== authGeneration.current) return;
      if (error.code === 'AUTH_REQUIRED') handleFailure(error);
      else { if (error.payload?.status) setDiagnosticStatus(error.payload.status); setNotice({ type: 'danger', text: error.message }); setDataError(error.message); }
    } finally { if (generation === authGeneration.current) setSyncing(false); }
  };
  const logout = async () => {
    if (accountMutationPending.current || authenticationActionPending.current) return;
    authenticationActionPending.current = true;
    try { await api.logout(); await checkSession(); setPayload(null); setDiagnosticStatus(null); setNotice(null); }
    catch (error) { setNotice({ type: 'danger', text: error.message }); }
    finally { authenticationActionPending.current = false; }
  };
  const onLogin = async (mode, email, password) => {
    if (accountMutationPending.current || authenticationActionPending.current) throw new Error('Permintaan akun sedang diproses. Tunggu hingga selesai.');
    authenticationActionPending.current = true;
    try {
      if (mode === 'demo') await api.demo(); else await api.login(email, password);
      const verified = await checkSession();
      if (!verified) throw new Error('Sesi belum dapat diverifikasi. Coba masuk kembali.');
      setLoginNotice(''); setLoginEmail('');
      window.location.hash = '#/dashboard';
    } finally { authenticationActionPending.current = false; }
  };

  const updateAccount = async fields => {
    if (accountMutationPending.current || authenticationActionPending.current) throw new Error('Permintaan akun sedang diproses. Tunggu hingga selesai.');
    const generation = authGeneration.current;
    accountMutationPending.current = true;
    setAccountUpdating(true);
    try {
      await api.updateAccount(fields);
      if (generation !== authGeneration.current) return;
      authGeneration.current++;
      setUser(null); setPayload(null); setDiagnosticStatus(null); setDataError(''); setNotice(null);
      setLoading(false); setSyncing(false);
      setLoginEmail(fields.email);
      setLoginNotice('Akun berhasil diperbarui. Silakan masuk kembali.');
      window.location.hash = '#/login';
    } catch (error) {
      if (generation !== authGeneration.current) return;
      if (error.code === 'AUTH_REQUIRED') handleFailure(error);
      throw error;
    } finally {
      accountMutationPending.current = false;
      setAccountUpdating(false);
    }
  };

  const filters = useMemo(() => {
    const preset = route.filters.preset || 'year';
    const years = [...(payload?.data.years || [])].sort((a, b) => a - b);
    return { year: String(years.at(-1) || ''), preset, ...presetRange(preset, today), ...route.filters };
  }, [route.filters, payload?.data.years, today]);
  const updateFilters = changes => {
    window.location.hash = routeHref(route.page === 'school-detail' ? 'schools' : route.page, filters, { ...changes, page: undefined }, route.page === 'school-detail' ? route.id : undefined);
  };
  const href = (page, changes = {}, id) => routeHref(page, filters, { page: undefined, visit: undefined, ...changes }, id);
  const context = { data: payload?.data, status: payload?.status || diagnosticStatus, filters, updateFilters, href, today, sync, syncing, user, updateAccount };

  if (!sessionChecked || (sessionError && !user)) return <div className="access-state" role="status"><div className="access-mark"><ShieldCheck size={28}/></div><h1>{sessionError ? 'Server belum dapat dihubungi' : 'Memeriksa akses Anda'}</h1><p>{sessionError || 'Menyiapkan ruang kerja yang aman…'}</p>{sessionError && <button className="btn btn-primary" onClick={checkSession}><RefreshCw size={16}/> Coba lagi</button>}</div>;
  if (!user) return <LoginPage demoAvailable={demoAvailable} onLogin={onLogin} initialEmail={loginEmail} successMessage={loginNotice} externalBusy={accountUpdating}/>;

  let page;
  if (route.page === 'account') page = <AccountPage/>;
  else if (!payload) page = route.page === 'data-status' ? <DataStatusPage/> : <div className="data-loading" role="status">{loading ? <><div className="spinner-border text-primary"/><h1>Menyiapkan data marketing</h1><p>Memuat data yang diizinkan untuk akun Anda.</p></> : <><AlertCircle size={32}/><h1>Data belum tersedia</h1><p>{dataError || 'Sumber data belum dapat dimuat. Tidak ada data pengganti yang ditampilkan.'}</p><button className="btn btn-primary" onClick={() => loadData()}>Coba muat lagi</button><a href={href('data-status')} onClick={e => { e.preventDefault(); window.location.hash = href('data-status'); }}>Periksa status sumber data</a><a href={href('data-status')} onClick={e => { e.preventDefault(); sync(); }}>Coba sinkronkan sumber</a></>}</div>;
  else {
    switch (route.page) {
      case 'dashboard': case 'login': page = <DashboardPage/>; break;
      case 'schools': page = <SchoolsPage/>; break;
      case 'school-detail': page = <SchoolDetailPage id={route.id}/>; break;
      case 'tiers': page = <TiersPage/>; break;
      case 'visits': page = <VisitsPage/>; break;
      case 'follow-ups': page = <FollowUpsPage/>; break;
      case 'data-status': page = <DataStatusPage/>; break;
      default: page = <div className="empty-state"><h1>Halaman tidak ditemukan</h1><p>Alamat ini tidak tersedia di ruang kerja marketing.</p><a className="btn btn-primary" href={href('dashboard')}>Kembali ke ringkasan</a></div>;
    }
  }
  return <DashboardContext.Provider value={context}><AppLayout page={route.page} user={user} status={payload?.status || diagnosticStatus} onLogout={logout} logoutDisabled={accountUpdating}>
    {payload?.status.mode === 'demo' && <div className="demo-banner" role="note"><span className="demo-label">DEMO</span><span><strong>Ruang eksplorasi · data sepenuhnya fiktif.</strong> Bukan data operasional dan tidak terhubung ke Google Sheets.</span><a href={href('data-status')}>Tentang data <span aria-hidden="true">↗</span></a></div>}
    {(payload?.status.error || (dataError && payload)) && <div className="alert alert-warning stale-banner" role="alert"><AlertCircle size={18}/><div><strong>Data terakhir ditampilkan. Sinkronisasi belum berhasil.</strong><br/>{payload?.status.error || dataError} Angka di bawah belum tentu mencerminkan perubahan terbaru.</div></div>}
    {notice && <div className={`alert alert-${notice.type} notice-banner`} role="status"><span>{notice.text}</span><button type="button" aria-label="Tutup pemberitahuan" onClick={() => setNotice(null)}>×</button></div>}
    {page}
  </AppLayout></DashboardContext.Provider>;
}
