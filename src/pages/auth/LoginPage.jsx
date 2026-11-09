import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Layers, CalendarCheck, Building2, LockKeyhole } from 'lucide-react';
import Brand from '../../components/layout/Brand.jsx';
export default function LoginPage({ demoAvailable, onLogin, initialEmail = '', successMessage = '', externalBusy = false }) {
  const [email, setEmail] = useState(initialEmail);
  useEffect(() => { setEmail(initialEmail); }, [initialEmail]);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event, mode = 'login') => {
    event.preventDefault();
    if (busy || externalBusy) return;
    setError(''); setBusy(true);
    try { await onLogin(mode, email, password); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <main className="login-page">
    <section className="login-story" aria-label="Tentang ruang kerja marketing"><Brand light/><div className="login-story-content"><span className="login-eyebrow"><span/> MARKETING OFFLINE DUTA PERSADA</span><h1>Usia Muda<br/>Karir Mendunia<br/></h1><p>Sekolah, aktivitas tim, dan tindak lanjut.<br/>Satu pandangan untuk langkah berikutnya.</p><div className="login-capabilities"><span><Building2 size={18}/> Relasi sekolah</span><span><Layers size={18}/> Prioritas tahunan</span><span><CalendarCheck size={18}/> Aktivitas & follow-up</span></div></div><div className="login-story-footer"><span>LPK Duta Persada Yogyakarta</span><span>Monitor · v1.0</span></div><div className="login-grid" aria-hidden="true"/></section>
    <section className="login-form-panel"><div className="login-mobile-brand"><Brand/></div><div className="login-form-wrap"><span className="login-lock"><LockKeyhole size={22}/></span><div className="eyebrow">AKSES INTERNAL</div><h2>Selamat datang kembali</h2><p className="login-intro">Masuk untuk melihat perkembangan Marketing Duta Persada.</p>
      {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
      {externalBusy && <div className="alert alert-info" role="status">Menunggu pembaruan akun selesai sebelum masuk kembali.</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={submit}><div className="mb-3"><label className="form-label" htmlFor="email">Email</label><input className="form-control" id="email" name="email" type="email" autoComplete="username" placeholder="Masukan Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy || externalBusy}/></div><div className="mb-4"><label className="form-label" htmlFor="password">Kata sandi</label><div className="password-input"><input className="form-control" id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan kata sandi" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy || externalBusy}/><button type="button" className="icon-button" aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div><button className="btn btn-primary login-submit" type="submit" disabled={busy || externalBusy}>{busy ? 'Memverifikasi akses…' : 'Login'}{!busy && <ArrowRight size={18}/>}</button></form>
      {demoAvailable && <><div className="login-or"><span/>atau jelajahi terlebih dahulu<span/></div><button className="btn btn-outline-secondary demo-login" disabled={busy || externalBusy} onClick={event => submit(event, 'demo')}>Masuk mode demo <ArrowRight size={17}/></button><p className="demo-login-note">Data demo sepenuhnya fiktif. Tidak terhubung ke Google Sheets dan tidak memuat kontak pribadi.</p></>}
      <div className="login-security"><ShieldCheck size={17}/><span>Akses hanya untuk pengguna yang disetujui admin.<br/>Hubungi admin jika Anda membutuhkan akun.</span></div></div><p className="login-copyright">© LPK Duta Persada · Yogyakarta</p></section>
  </main>;
}
