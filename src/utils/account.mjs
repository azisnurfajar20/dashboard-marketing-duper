export function validateAccountUpdate({ email, currentPassword, newPassword, confirmPassword }, currentEmail) {
  const errors = {};
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = 'Masukkan email yang valid, maksimal 254 karakter.';
  if (!currentPassword) errors.currentPassword = 'Masukkan kata sandi saat ini.';
  else if (currentPassword.length > 256) errors.currentPassword = 'Kata sandi saat ini maksimal 256 karakter.';
  if (newPassword && (newPassword.length < 12 || newPassword.length > 256)) errors.newPassword = 'Kata sandi baru harus 12–256 karakter.';
  if (newPassword && confirmPassword !== newPassword) errors.confirmPassword = 'Konfirmasi kata sandi baru harus sama.';
  else if (!newPassword && confirmPassword) errors.confirmPassword = 'Isi kata sandi baru sebelum mengonfirmasi.';
  if (!Object.keys(errors).length && normalizedEmail === currentEmail.trim().toLowerCase() && !newPassword) errors.form = 'Ubah email atau isi kata sandi baru sebelum menyimpan.';
  return errors;
}
