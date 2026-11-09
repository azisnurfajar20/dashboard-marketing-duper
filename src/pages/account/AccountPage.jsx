import { useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { validateAccountUpdate } from '../../utils/account.mjs';
import '../../styles/account.css';

function PasswordField({ id, name, label, value, onChange, autoComplete, required = false, hint, minLength, error, inputRef }) {
  const [show, setShow] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className="account-field">
    <label className="form-label" htmlFor={id}>{label}</label>
    <div className="account-password-input">
      <input ref={inputRef} className="form-control" id={id} name={name} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required={required} minLength={minLength} maxLength={256} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy}/>
      <button type="button" className="icon-button" aria-controls={id} aria-pressed={show} aria-label={`${show ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
    </div>
    {hint && <p className="account-field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="account-field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}

export default function AccountPage() {
  const { user, updateAccount } = useDashboard();
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null), currentRef = useRef(null), newRef = useRef(null), confirmRef = useRef(null), alertRef = useRef(null);
  const refs = { email: emailRef, currentPassword: currentRef, newPassword: newRef, confirmPassword: confirmRef };
  const edit = (field, setter) => event => {
    setter(event.target.value);
    setErrors(previous => { const next = { ...previous }; delete next[field]; delete next.form; delete next.server; return next; });
  };
  const focusError = next => requestAnimationFrame(() => (refs[Object.keys(next)[0]]?.current || alertRef.current)?.focus());
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const fields = { email, currentPassword, newPassword, confirmPassword };
    const next = validateAccountUpdate(fields, user.email);
    setErrors(next);
    if (Object.keys(next).length) { focusError(next); return; }
    setBusy(true);
    try {
      await updateAccount({ ...fields, email: email.trim().toLowerCase() });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') {
        const failure = { server: error.message || 'Akun tidak dapat diperbarui. Coba lagi nanti.' };
        setErrors(failure); focusError(failure);
      }
    } finally { setBusy(false); }
  };
  const demo = user.id === 'demo-user' && user.email === 'demo@example.invalid';
  return <section className="account-page" data-testid="page-account" aria-labelledby="account-heading">
    <div className="page-heading"><div><div className="eyebrow">PENGELOLAAN</div><h1 id="account-heading">Pengaturan akun</h1><p>Kelola email login dan kata sandi dashboard Anda.</p></div></div>
    {demo ? <div className="surface-card account-demo" role="note"><ShieldCheck size={24}/><div><h2>Akun demo bersifat hanya-baca</h2><p>Email dan kata sandi akun demo tidak dapat diubah. Masuk dengan akun yang disetujui admin untuk mengelola login dashboard Anda.</p></div></div> : <div className="account-grid">
      <section className="surface-card account-card" aria-labelledby="account-form-heading">
        <div className="account-card-heading"><LockKeyhole size={20}/><div><h2 id="account-form-heading">Email & kata sandi</h2><p>Konfirmasikan kata sandi saat ini untuk menyimpan perubahan.</p></div></div>
        {Object.keys(errors).length > 0 && <div ref={alertRef} tabIndex={-1} className="alert alert-danger account-alert" role="alert">{Object.values(errors).join(' ')}</div>}
        <form className="account-form" onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset disabled={busy}>
            <div className="account-field"><label className="form-label" htmlFor="account-email">Email login</label><input ref={emailRef} className="form-control" id="account-email" name="email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={edit('email', setEmail)} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={`account-email-hint${errors.email ? ' account-email-error' : ''}`}/><p className="account-field-hint" id="account-email-hint">Gunakan email ini saat masuk kembali ke dashboard.</p>{errors.email && <p className="account-field-error" id="account-email-error">{errors.email}</p>}</div>
            <PasswordField inputRef={currentRef} id="account-current-password" name="currentPassword" label="Kata sandi saat ini" value={currentPassword} onChange={edit('currentPassword', setCurrentPassword)} autoComplete="current-password" required error={errors.currentPassword}/>
            <div className="account-form-divider"/>
            <PasswordField inputRef={newRef} id="account-new-password" name="newPassword" label="Kata sandi baru" value={newPassword} onChange={edit('newPassword', setNewPassword)} autoComplete="new-password" minLength={12} hint="Opsional · 12–256 karakter. Kosongkan jika tidak ingin mengubah kata sandi." error={errors.newPassword}/>
            <PasswordField inputRef={confirmRef} id="account-confirm-password" name="confirmPassword" label="Konfirmasi kata sandi baru" value={confirmPassword} onChange={edit('confirmPassword', setConfirmPassword)} autoComplete="new-password" required={Boolean(newPassword)} error={errors.confirmPassword}/>
            <div className="account-form-actions"><p>Setelah disimpan, semua sesi lama berakhir.</p><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>
          </fieldset>
        </form>
      </section>
      <aside className="surface-card account-info" aria-labelledby="account-info-heading"><ShieldCheck size={22}/><h2 id="account-info-heading">Hanya untuk login dashboard</h2><p>Perubahan ini tidak mengubah akun Google atau izin Google Sheets. Sumber data marketing tetap hanya dibaca.</p><p>File login-awal tidak diperbarui otomatis. Simpan informasi login Anda di tempat yang aman.</p></aside>
    </div>}
  </section>;
}
