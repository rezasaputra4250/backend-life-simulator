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

const allMissionSeeds = [
  ...missionSeeds.map((mission) => ({ ...mission, frequency: 'daily' })),
  ...muslimHabitSeeds.map((mission) => ({ ...mission, frequency: 'daily' })),
  ...weeklyMissionSeeds,
  ...monthlyMissionSeeds,
];

module.exports = { missionSeeds, weeklyMissionSeeds, monthlyMissionSeeds, allMissionSeeds };
