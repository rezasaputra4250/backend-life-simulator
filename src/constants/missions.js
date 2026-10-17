const { muslimHabitSeeds } = require('./muslimHabits');

const missionSeeds = [
  { title: 'Selesaikan tugas utama', scheduled_time: '09:00:00', detail: 'Fokus kerja - 30 menit', reward: 50, reward_type: 'xp', reward_name: '50 XP', reward_key: 'xp' },
  { title: 'Latihan pagi', scheduled_time: '06:30:00', detail: 'Kebugaran - 20 menit', reward: 30, reward_type: 'item', reward_name: 'Potion Energi', reward_key: 'energy-potion' },
  { title: 'Baca satu bab buku', scheduled_time: '20:00:00', detail: 'Pengetahuan - 15 menit', reward: 25, reward_type: 'skill', reward_name: 'problem_solving', reward_key: 'problem_solving' },
  { title: 'Tulis jurnal harian', scheduled_time: '21:00:00', detail: 'Refleksi - 10 menit', reward: 20, reward_type: 'item', reward_name: 'Buku Jurnal', reward_key: 'journal-book' },
  { title: 'Rapikan meja kerja', scheduled_time: '08:45:00', detail: 'Kerapian - 10 menit', reward: 15, reward_type: 'badge', reward_name: 'Penjaga Kerapian', reward_key: 'tidy-keeper' },
  { title: 'Minum air yang cukup', scheduled_time: '10:00:00', detail: 'Kesehatan - 8 gelas', reward: 15, reward_type: 'item', reward_name: 'Ramuan Vitalitas', reward_key: 'vitality-potion' },
  { title: 'Pelajari skill baru', scheduled_time: '19:00:00', detail: 'Pengembangan diri - 25 menit', reward: 40, reward_type: 'skill', reward_name: 'leadership', reward_key: 'leadership' },
  { title: 'Selesaikan satu tugas kecil', scheduled_time: '14:00:00', detail: 'Produktivitas - 15 menit', reward: 20, reward_type: 'xp', reward_name: '20 XP', reward_key: 'xp' },
  { title: 'Berjalan kaki sejenak', scheduled_time: '16:30:00', detail: 'Kebugaran - 15 menit', reward: 20, reward_type: 'item', reward_name: 'Sepatu Lincah', reward_key: 'swift-boots' },
  { title: 'Kirim apresiasi kepada rekan', scheduled_time: '15:00:00', detail: 'Sosial - 5 menit', reward: 15, reward_type: 'badge', reward_name: 'Rekan Pendukung', reward_key: 'supportive-ally' },
  { title: 'Rencanakan prioritas besok', scheduled_time: '21:30:00', detail: 'Perencanaan - 10 menit', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Istirahat tanpa layar', scheduled_time: '22:00:00', detail: 'Keseimbangan - 20 menit', reward: 30, reward_type: 'item', reward_name: 'Kristal Fokus', reward_key: 'focus-crystal' },
];

const weeklyMissionSeeds = [
  { title: 'Evaluasi target minggu ini', scheduled_time: '20:30:00', detail: 'Perencanaan - 20 menit', reward: 60, reward_type: 'xp', reward_name: '60 XP', reward_key: 'xp', frequency: 'weekly' },
  { title: 'Olahraga tiga kali minggu ini', scheduled_time: null, detail: 'Kebugaran - 3 sesi', reward: 75, reward_type: 'item', reward_name: 'Potion Energi', reward_key: 'energy-potion', frequency: 'weekly' },
  { title: 'Baca satu artikel bermanfaat', scheduled_time: null, detail: 'Pengetahuan - 30 menit', reward: 50, reward_type: 'skill', reward_name: 'problem_solving', reward_key: 'problem_solving', frequency: 'weekly' },
  { title: 'Bersedekah setiap pekan', scheduled_time: null, detail: 'Kebaikan - Sesuai kemampuan', reward: 50, reward_type: 'badge', reward_name: 'Dermawan', reward_key: 'supportive-ally', frequency: 'weekly' },
];

const monthlyMissionSeeds = [
  { title: 'Evaluasi perkembangan bulan ini', scheduled_time: null, detail: 'Refleksi - 30 menit', reward: 100, reward_type: 'xp', reward_name: '100 XP', reward_key: 'xp', frequency: 'monthly' },
  { title: 'Selesaikan satu buku', scheduled_time: null, detail: 'Pengetahuan - 1 buku', reward: 125, reward_type: 'skill', reward_name: 'problem_solving', reward_key: 'problem_solving', frequency: 'monthly' },
  { title: 'Donasi atau sedekah bulanan', scheduled_time: null, detail: 'Kebaikan - Sesuai kemampuan', reward: 100, reward_type: 'badge', reward_name: 'Dermawan Bulanan', reward_key: 'supportive-ally', frequency: 'monthly' },
  { title: 'Rapikan dan tinjau keuangan', scheduled_time: null, detail: 'Perencanaan - 45 menit', reward: 100, reward_type: 'item', reward_name: 'Kristal Fokus', reward_key: 'focus-crystal', frequency: 'monthly' },
];

const classMissionSeeds = [
  { required_class: 'pelajar', title: 'Selesaikan sesi belajar fokus', scheduled_time: '16:00:00', detail: 'Fokus - 30 menit tanpa distraksi', reward: 35, reward_type: 'skill', reward_name: 'Fokus', reward_key: 'focus' },
  { required_class: 'pelajar', title: 'Rangkum pelajaran hari ini', scheduled_time: '19:30:00', detail: 'Riset dan pemahaman - 20 menit', reward: 30, reward_type: 'skill', reward_name: 'Riset', reward_key: 'research' },
  { required_class: 'pelajar', title: 'Susun jadwal belajar besok', scheduled_time: '21:00:00', detail: 'Manajemen waktu - 10 menit', reward: 25, reward_type: 'skill', reward_name: 'Manajemen Waktu', reward_key: 'time_management' },
  { required_class: 'mahasiswa', title: 'Baca dan kritik satu sumber', scheduled_time: '17:00:00', detail: 'Berpikir kritis - 30 menit', reward: 40, reward_type: 'skill', reward_name: 'Berpikir Kritis', reward_key: 'critical_thinking' },
  { required_class: 'mahasiswa', title: 'Latihan presentasi singkat', scheduled_time: '18:30:00', detail: 'Presentasi - 15 menit', reward: 30, reward_type: 'skill', reward_name: 'Presentasi', reward_key: 'presentation' },
  { required_class: 'mahasiswa', title: 'Diskusi produktif dengan teman', scheduled_time: '20:00:00', detail: 'Kolaborasi - 20 menit', reward: 35, reward_type: 'skill', reward_name: 'Kolaborasi', reward_key: 'collaboration' },
  { required_class: 'petani', title: 'Periksa kondisi tanaman', scheduled_time: '06:00:00', detail: 'Budi daya - 20 menit', reward: 35, reward_type: 'skill', reward_name: 'Budi Daya', reward_key: 'cultivation' },
  { required_class: 'petani', title: 'Rawat alat dan lahan kerja', scheduled_time: '08:00:00', detail: 'Pengelolaan sumber daya - 20 menit', reward: 30, reward_type: 'skill', reward_name: 'Pengelolaan Sumber Daya', reward_key: 'resource_management' },
  { required_class: 'petani', title: 'Jaga stamina dengan istirahat cukup', scheduled_time: '20:30:00', detail: 'Ketahanan - persiapan hari esok', reward: 25, reward_type: 'skill', reward_name: 'Ketahanan', reward_key: 'endurance' },
  { required_class: 'karyawan', title: 'Tentukan tiga prioritas kerja', scheduled_time: '08:30:00', detail: 'Manajemen waktu - 10 menit', reward: 30, reward_type: 'skill', reward_name: 'Manajemen Waktu', reward_key: 'time_management' },
  { required_class: 'karyawan', title: 'Tulis ringkasan pekerjaan', scheduled_time: '17:30:00', detail: 'Penulisan profesional - 15 menit', reward: 35, reward_type: 'skill', reward_name: 'Penulisan Profesional', reward_key: 'professional_writing' },
  { required_class: 'karyawan', title: 'Bantu satu rekan menyelesaikan tugas', scheduled_time: '15:00:00', detail: 'Kolaborasi - sesuai kebutuhan', reward: 30, reward_type: 'skill', reward_name: 'Kolaborasi', reward_key: 'collaboration' },
  { required_class: 'wirausahawan', title: 'Catat pemasukan dan pengeluaran', scheduled_time: '20:00:00', detail: 'Literasi keuangan - 15 menit', reward: 40, reward_type: 'skill', reward_name: 'Literasi Keuangan', reward_key: 'financial_literacy' },
  { required_class: 'wirausahawan', title: 'Tulis satu ide penawaran baru', scheduled_time: '09:00:00', detail: 'Kreativitas - 20 menit', reward: 35, reward_type: 'skill', reward_name: 'Kreativitas', reward_key: 'creativity' },
  { required_class: 'wirausahawan', title: 'Hubungi calon pelanggan', scheduled_time: '13:00:00', detail: 'Pemasaran - 15 menit', reward: 35, reward_type: 'skill', reward_name: 'Pemasaran', reward_key: 'marketing' },
  { required_class: 'pekerja_lepas', title: 'Susun target kerja mandiri', scheduled_time: '08:00:00', detail: 'Pengelolaan diri - 10 menit', reward: 30, reward_type: 'skill', reward_name: 'Pengelolaan Diri', reward_key: 'self_management' },
  { required_class: 'pekerja_lepas', title: 'Perbarui portofolio digital', scheduled_time: '18:00:00', detail: 'Perangkat digital - 20 menit', reward: 35, reward_type: 'skill', reward_name: 'Perangkat Digital', reward_key: 'digital_tools' },
  { required_class: 'pekerja_lepas', title: 'Kirim pembaruan kepada klien', scheduled_time: '15:30:00', detail: 'Pengelolaan klien - 10 menit', reward: 35, reward_type: 'skill', reward_name: 'Pengelolaan Klien', reward_key: 'client_management' },
];

const allMissionSeeds = [
  ...missionSeeds.map((mission) => ({ ...mission, frequency: 'daily' })),
  ...muslimHabitSeeds.map((mission) => ({ ...mission, frequency: 'daily' })),
  ...weeklyMissionSeeds,
  ...monthlyMissionSeeds,
  ...classMissionSeeds,
];

module.exports = { missionSeeds, weeklyMissionSeeds, monthlyMissionSeeds, classMissionSeeds, allMissionSeeds };
