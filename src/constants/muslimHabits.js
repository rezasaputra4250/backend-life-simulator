const muslimHabitSeeds = [
  { title: 'Salat Subuh', scheduled_time: '04:30:00', detail: 'Salat wajib - 2 rakaat', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Salat Zuhur', scheduled_time: '12:00:00', detail: 'Salat wajib - 4 rakaat', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Salat Asar', scheduled_time: '15:15:00', detail: 'Salat wajib - 4 rakaat', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Salat Magrib', scheduled_time: '18:00:00', detail: 'Salat wajib - 3 rakaat', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Salat Isya', scheduled_time: '19:15:00', detail: 'Salat wajib - 4 rakaat', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Salat Duha', scheduled_time: '07:00:00', detail: 'Salat sunah - Minimal 2 rakaat', reward: 20, reward_type: 'xp', reward_name: '20 XP', reward_key: 'xp' },
  { title: 'Salat Tahajud', scheduled_time: '03:30:00', detail: 'Salat sunah - Minimal 2 rakaat', reward: 30, reward_type: 'xp', reward_name: '30 XP', reward_key: 'xp' },
  { title: 'Salat Witir', scheduled_time: '22:00:00', detail: 'Salat sunah - Minimal 1 rakaat', reward: 20, reward_type: 'xp', reward_name: '20 XP', reward_key: 'xp' },
  { title: 'Tadarus Al-Quran', scheduled_time: '05:30:00', detail: 'Ibadah harian - Minimal 1 halaman', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
  { title: 'Dzikir Pagi dan Petang', scheduled_time: '06:00:00', detail: 'Ibadah harian - 10 menit', reward: 20, reward_type: 'xp', reward_name: '20 XP', reward_key: 'xp' },
  { title: 'Membaca Doa Harian', scheduled_time: '06:15:00', detail: 'Ibadah harian - 5 menit', reward: 15, reward_type: 'xp', reward_name: '15 XP', reward_key: 'xp' },
  { title: 'Bersedekah', scheduled_time: '12:30:00', detail: 'Kebaikan - Sesuai kemampuan', reward: 25, reward_type: 'xp', reward_name: '25 XP', reward_key: 'xp' },
];

module.exports = {
  muslimHabitSeeds: muslimHabitSeeds.map((mission) => ({
    ...mission,
    required_religion: 'islam',
  })),
};
