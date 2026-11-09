export function createApiClient(fetcher = (...args) => fetch(...args)) {
  async function request(path, body) {
    let response;
    try {
      response = await fetcher(`/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw Object.assign(new Error('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.'), { code: 'NETWORK_ERROR' });
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw Object.assign(new Error('Respons server tidak dapat dibaca. Coba lagi sebentar.'), { code: 'INVALID_RESPONSE', status: response.status }); }
    if (!response.ok) {
      const message = typeof payload.message === 'string' ? payload.message : response.status === 401 ? 'Sesi berakhir. Silakan masuk kembali.' : 'Permintaan gagal. Silakan coba kembali.';
      throw Object.assign(new Error(message), { status: response.status, code: response.status === 401 ? 'AUTH_REQUIRED' : typeof payload.error === 'string' ? payload.error : 'API_ERROR', payload });
    }
    return payload;
  }
  return {
    session: () => request('/auth/session'),
    login: (email, password) => request('/auth/login', { email, password }),
    demo: () => request('/auth/demo', {}),
    logout: () => request('/auth/logout', {}),
    updateAccount: ({ email, currentPassword, newPassword, confirmPassword }) => request('/auth/account', { email, currentPassword, newPassword, confirmPassword }),
    data: () => request('/data'),
    sync: () => request('/sync', {}),
  };
}
export const api = createApiClient();
