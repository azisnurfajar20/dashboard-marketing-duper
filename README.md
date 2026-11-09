<<<<<<< HEAD
# Dashboard Marketing Lapangan — LPK Duta Persada Yogyakarta

Website internal, berbahasa Indonesia, untuk memantau sekolah, tier tahunan, kunjungan marketing, tindak lanjut, dan kualitas data. **Input/perubahan data tetap dilakukan di Google Sheets. Website tidak menulis ke spreadsheet.**

## Lokasi dan kebutuhan

- Folder proyek: `D:\marketing-dashboard`.
- Node.js 22.12 atau lebih baru dan npm.
- Browser modern. Zona waktu perhitungan follow-up: `Asia/Jakarta`.

## Mulai cepat (Google Sheets lokal)

Di File Explorer, buka `D:\marketing-dashboard`, lalu klik dua kali **`Jalankan Dashboard.cmd`**. Launcher membuka browser setelah koneksi dashboard terverifikasi. Jika dashboard sudah berjalan, launcher memakai server yang sama, bukan menjalankan server kedua.

Konfigurasi lokal saat ini memakai **Google Sheets asli, read-only**, bukan demo. Buka `http://127.0.0.1:3001`, lalu masuk memakai akun lokal yang disetujui. Informasi login awal tersimpan hanya di file privat `C:\Users\Acer\AppData\Local\marketing-dashboard\secrets\akses-dashboard.txt`; jangan unggah isinya atau JSON key ke chat/Git. File `.env`, key, allowlist, cache, serta sesi tidak boleh dibagikan. Secret sesi yang sudah ada dipertahankan; key dan penyimpanan privat berada di luar folder proyek.

Lihat **Status data** untuk waktu sinkronisasi, status `Terhubung`, dan masalah sumber. Pembaruan otomatis dijadwalkan setiap lima menit; tombol **Perbarui data** mengambil data sumber segera. Input/perubahan tetap hanya di Google Sheets. `Riwayat Kunjungan` belum memiliki baris kunjungan saat uji koneksi nyata.

Alternatif, dari terminal di folder proyek:

```bash
npm install
npm run build
npm start
```

Salinan proyek baru tetap memakai default `.env.example` berupa **demo fiktif** sampai dikonfigurasi secara eksplisit. Kredensial Google, data sumber nyata, allowlist, sesi, dan cache tidak disertakan dalam kode proyek. Demo tidak boleh dipakai sebagai laporan operasional. Jika membuat salinan proyek, buat `SESSION_SECRET` acak milik sendiri dan ikuti panduan Google Sheets di bawah.

## Pengembangan

Panduan mengedit kode sendiri, memilih alamat preview yang benar, dan menerapkan hasil edit: `PANDUAN-EDIT-KODE.md`.

```bash
npm run dev
```

- Frontend Vite: `http://127.0.0.1:5173`.
- API Express: `http://127.0.0.1:3001`.
- Vite meneruskan `/api` ke server; tidak memerlukan CORS publik.
- Hentikan server sebelumnya jika port 3001 sudah dipakai.

```bash
npm test
npm run build
```

Suite `tests/e2e/dashboard.spec.mjs` menguji **demo fiktif**, bukan akun/data Google Sheets. Jalankan pada server uji terisolasi agar website live port 3001 tidak diubah atau dihentikan. Contoh melalui bash, terminal pertama:

```bash
DATA_MODE=demo HOST=127.0.0.1 PORT=3105 APP_ORIGIN=http://127.0.0.1:3105 CACHE_DIR=server/private/cache-e2e SESSION_DIR=server/private/sessions-e2e node server/index.mjs
```

Pada terminal kedua:

```bash
E2E_BASE_URL=http://127.0.0.1:3105 npm run test:e2e -- --workers=1
```

Hentikan hanya server uji setelah selesai. Environment per-proses ini tidak mengganti konfigurasi live di `.env`. Uji integrasi nyata menggunakan login approved, API `mode=sheets`, pencocokan sumber, dan tombol sinkronisasi; tidak memakai `Masuk mode demo`.

Tes perubahan kredensial memakai konfigurasi terpisah yang otomatis menjalankan akun dan workbook fiktif di port 3110; **jangan menguji mutasi akun terhadap server live**:

```bash
npx playwright test -c playwright.account.config.mjs
```

Tes browser memerlukan Chromium Playwright:

```bash
npx playwright install chromium
```

## Halaman

1. **Ringkasan** — KPI yang dapat dibuka ke daftar pendukung, tier, daerah, tren kunjungan, marketing pelaksana, dan tindak lanjut.
2. **Data sekolah** — pencarian nama/ID, filter daerah, penanggung jawab, status, tier, tahun, serta pengurutan dan detail.
3. **Detail sekolah** — identitas, PIC, riwayat tier, hasil dan riwayat kunjungan, tindak lanjut; tautan WhatsApp hanya membuka kontak, tidak mengirim pesan.
4. **Tier sekolah** — perbandingan dua tahun; kosong dan nilai tidak valid tidak dianggap naik/turun.
5. **Riwayat kunjungan** — filter periode, daerah, sekolah, pelaksana dan kegiatan.
6. **Follow-up** — terlambat, hari ini, mendatang, belum dijadwalkan, selesai, dibatalkan, status belum diisi, dan tanggal bermasalah.
7. **Status data** — koneksi, sinkronisasi terakhir, masalah data beserta tab dan nomor baris sumber.
8. **Pengaturan akun** — ubah email login dan/atau password milik sendiri dengan konfirmasi password saat ini; setelah disimpan harus login ulang. Panduan: `docs/ACCOUNT.md`. Ini tidak mengubah akun Google atau isi spreadsheet.

Tahun tier dan periode aktivitas adalah kontrol terpisah. **Marketing penanggung jawab** mengacu pada sekolah; **marketing pelaksana** mengacu pada kunjungan. Dashboard tidak menghitung calon siswa, DP, konversi, atau jumlah siswa kelas XII.

## Menghubungkan Google Sheets asli

Lihat panduan lengkap di [`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md).

Ringkasannya:

1. Siapkan empat tab sesuai `docs/PRD.md`: `Data Sekolah`, `Data Pic Sekolah`, `Data Tier Sekolah`, `Riwayat Kunjungan`.
2. Aktifkan Google Sheets API di proyek Google Cloud. Buat service account khusus dan berikan akun tersebut akses **Viewer** hanya pada spreadsheet yang diperlukan. Tidak perlu membuat spreadsheet publik.
3. Simpan berkas JSON kredensial secara privat, **di luar `public`, `src`, dan `dist`**, idealnya di luar folder proyek. Jangan mengirim kredensial melalui chat atau memasukkannya ke Git.
4. Atur `.env`: `DATA_MODE=sheets`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_FILE`, `SESSION_SECRET` yang kuat, dan lokasi `USERS_FILE`.
5. Tambahkan pengguna yang disetujui admin, misalnya `npm run create-user -- --name "Admin Marketing" --email "admin@example.org" --role coordinator`. Masukkan password melalui prompt tersembunyi; jangan menaruh password di argumen terminal, berkas publik, atau chat. Script menyimpan hash scrypt, bukan kata sandi biasa.
6. Mulai ulang server. Masuk menggunakan akun yang dibuat. Periksa **Status data** sebelum menggunakan angka secara operasional.
7. Cocokkan angka sekolah/tier/kunjungan dengan spreadsheet pada filter yang sama dan lakukan uji operasional bersama tim.

Integrasi memakai scope `spreadsheets.readonly`. Sinkronisasi dijadwalkan setiap lima menit dan dapat diminta melalui **Perbarui data**. Kegagalan tidak mengubah cache terakhir menjadi nol dan tidak beralih diam-diam ke demo. Hilang/bergantinya kolom wajib menjadi kesalahan sinkronisasi, bukan dataset kosong.

## Mengganti logo

Tempat aset: `public/assets/images/logo/`. Pertahankan placeholder bertuliskan **LPK Duta Persada** sampai berkas logo asli tersedia. Penempatan tersedia pada login, sidebar, dan navigasi HP. Gambar harus menggunakan `object-fit: contain` agar proporsinya tidak terpotong. Setelah mengganti aset, jalankan `npm run build` kembali untuk server produksi.

## Struktur

```text
public/assets/       Aset publik saja; tidak ada data internal/kredensial
src/components/      Layout dan komponen bersama
src/pages/           Halaman login, ringkasan, sekolah, tier, kunjungan, follow-up, status
src/services/api/    Klien API same-origin
src/styles/          Tema terpusat dan CSS khusus di luar komponen
src/utils/           Format dan perilaku UI
shared/              Normalisasi, validasi, filter, dan perhitungan bersama
server/config/       Konfigurasi server dan pengguna privat
server/services/     Sumber demo dan integrasi Google Sheets baca-saja
server/middleware/   Login dan perlindungan request
server/routes/       API
scripts/             Utilitas administrasi lokal
 tests/              Pengujian aturan, API, sinkronisasi, dan browser
 docs/               PRD, kontrak, panduan data dan konfigurasi
```

## Batasan dan keamanan deployment

- Server lokal terikat ke loopback secara default; belum merupakan deployment internet.
- Untuk server publik: gunakan HTTPS/reverse proxy, cookie secure, origin/host yang diizinkan secara eksplisit, akun riil dan mode `sheets`. Jangan mengaktifkan login demo pada data riil.
- Batasi akses berkas kredensial, pengguna, sesi, dan cache pada akun proses server. Cache/sesi juga memuat data internal; jangan disajikan sebagai aset statis atau dipublikasikan.
- Error yang dikirim ke browser tidak boleh memuat kredensial atau nilai nomor WhatsApp.
- Perubahan logo/CSS/source memerlukan build ulang. Perubahan `.env` memerlukan restart.
- Target performa diuji lokal terhadap fixture; waktu muat jaringan produksi dan kesesuaian dengan spreadsheet nyata perlu diverifikasi setelah integrasi dan deployment.

Status penerimaan dan hasil pengujian akhir dicatat di `docs/ACCEPTANCE.md` dan `docs/VERIFICATION.md`.
=======
# dashboard-marketing
>>>>>>> 4a7a33a933891f4f3bec4b2e3f30f4299bda4130
