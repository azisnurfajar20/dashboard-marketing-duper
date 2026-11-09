import { jakartaToday } from '../../shared/selectors.mjs';

// Entirely fictional, private server-side fixture. Never import this file in the browser.
export function createDemoWorkbook(now = new Date()) {
  const today = jakartaToday(now);
  const base = new Date(`${today}T00:00:00Z`);
  const day = (offset) => new Date(base.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const regions = ['Sleman', 'Bantul', 'Kota Yogyakarta', 'Kulon Progo', 'Gunungkidul'];
  const labels = ['Angkasa', 'Cakrawala', 'Lentera', 'Pijar', 'Pelangi', 'Arunika', 'Samudra', 'Bintang', 'Mekar', 'Nusantara'];
  const marketers = ['Marketing DEMO A', 'Marketing DEMO B', 'Marketing DEMO C', 'Marketing DEMO D'];
  const schools = [['ID Sekolah', 'Nama Sekolah', 'Daerah', 'Negeri/Swasta', 'Marketing Penanggung Jawab', 'Status Sekolah']];
  const pics = [['ID PIC', 'ID Sekolah', 'Nama PIC', 'Jabatan', 'Nomor WhatsApp', 'Status Kontak']];
  const tiers = [['ID Sekolah', 'Tier 2024', 'Tier 2025', 'Tier 2026', 'Keterangan']];
  const visits = [['ID Visit', 'Tanggal', 'ID Sekolah', 'Marketing pelaksana', 'Kegiatan', 'PIC yang ditemui', 'Hasil', 'Next Action', 'Tanggal Follow-up', 'Status Follow-up']];
  for (let index = 0; index < 50; index++) {
    const number = String(index + 1).padStart(3, '0');
    const id = `DEMO-S${number}`;
    schools.push([id, `${index % 3 === 0 ? 'SMA' : 'SMK'} DEMO ${labels[index % 10]} ${number} (Fiktif)`, regions[index % 5], index % 3 === 0 ? 'Negeri' : 'Swasta', marketers[index % 4], index % 11 === 0 ? 'Nonaktif' : 'Aktif']);
    for (let person = 0; person < 2; person++) pics.push([`DEMO-P${number}-${person + 1}`, id, `Guru DEMO ${number}-${person + 1} (Fiktif)`, person ? 'Wakil Kurikulum' : 'Guru BK', '', person && index % 7 === 0 ? 'Nonaktif' : 'Aktif']);
    const tier = (offset) => (index + offset) % 7 === 0 ? '' : `Tier ${1 + (index + offset) % 3}`;
    tiers.push([id, tier(0), tier(1), index === 9 ? 'Tier 9' : tier(2), 'DEMO — bukan penilaian sekolah nyata']);
    for (let visit = 0; visit < 4; visit++) {
      const sequence = index * 4 + visit;
      const kind = sequence % 9;
      const due = kind === 0 ? today : kind === 1 ? day(-9) : kind === 3 || kind === 8 ? '' : day(7 + sequence % 14);
      const status = kind === 4 || kind === 8 ? '' : kind === 5 ? 'Selesai' : kind === 6 ? 'Dibatalkan' : 'Belum Selesai';
      visits.push([`DEMO-V${String(sequence + 1).padStart(4, '0')}`, day(-((sequence * 13) % 270)), id, marketers[(index + visit) % 4], ['Silaturahmi BK; Titip Brosur', 'Sosialisasi', 'Titip Brosur', 'Koordinasi Kegiatan'][sequence % 4], `Guru DEMO ${number}-1 (Fiktif)`, ['DEMO: materi fiktif disampaikan', 'DEMO: jadwal fiktif dibahas', 'DEMO: menunggu konfirmasi fiktif'][sequence % 3], kind === 8 ? '' : 'DEMO: konfirmasi kegiatan fiktif', sequence === 7 ? 'tanggal-demo-tidak-valid' : due, status]);
    }
  }
  // Controlled data-quality examples: never quietly interpreted as valid data.
  schools.push(['DEMO-DUP', 'SMK DEMO Duplikat A (Fiktif)', 'Sleman', 'Swasta', marketers[0], 'Aktif']);
  schools.push(['DEMO-DUP', 'SMK DEMO Duplikat B (Fiktif)', 'Sleman', 'Swasta', marketers[0], 'Aktif']);
  pics.push(['DEMO-REF-ERROR', 'DEMO-NOT-FOUND', 'PIC DEMO Referensi Hilang (Fiktif)', 'Guru BK', '', 'Aktif']);
  visits.push(['DEMO-BAD-DATE', '2026-02-31', 'DEMO-S001', marketers[0], 'Silaturahmi BK', 'Guru DEMO', 'DEMO: tanggal tidak valid', '', '', '']);
  visits.push([...visits[1]]);
  return { 'Data Sekolah': schools, 'Data Pic Sekolah': pics, 'Data Tier Sekolah': tiers, 'Riwayat Kunjungan': visits };
}
