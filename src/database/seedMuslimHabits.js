require('dotenv').config();

const pool = require('../config/database');
const { muslimHabitSeeds } = require('../constants/muslimHabits');
const { ensureSystemMission } = require('../services/missionDomainService');

async function seedMuslimHabits() {
  const [users] = await pool.query('SELECT id, difficulty FROM users WHERE deleted_at IS NULL ORDER BY id ASC');

  for (const user of users) {
    for (const habit of muslimHabitSeeds) {
      await ensureSystemMission(pool, user.id, user.difficulty || 'easy', {
        ...habit,
        frequency: 'daily',
        duration_minutes: habit.duration_minutes || 15,
      });
    }
  }

  console.log(`Seeder habit Muslim selesai untuk ${users.length} pengguna.`);
}

module.exports = seedMuslimHabits;

if (require.main === module) {
  seedMuslimHabits()
    .catch((error) => {
      console.error('Seeder habit Muslim gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
