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

  await pool.end();
  console.log(`Seeder habit Muslim selesai untuk ${users.length} pengguna.`);
}

seedMuslimHabits().catch(async (error) => {
  console.error('Seeder habit Muslim gagal:', error.message);
  await pool.end();
  process.exit(1);
});
