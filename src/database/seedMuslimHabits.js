require('dotenv').config();

const pool = require('../config/database');
const { muslimHabitSeeds } = require('../constants/muslimHabits');

async function seedMuslimHabits() {
  const [users] = await pool.query('SELECT id, difficulty FROM users WHERE deleted_at IS NULL ORDER BY id ASC');

  for (const user of users) {
    for (const habit of muslimHabitSeeds) {
      await pool.query(
        `INSERT INTO missions
           (user_id, difficulty, mission_date, frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key)
         VALUES (?, ?, CURDATE(), 'daily', ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           frequency = VALUES(frequency), scheduled_time = VALUES(scheduled_time), detail = VALUES(detail)`,
        [
          user.id,
          user.difficulty || 'easy',
          habit.scheduled_time,
          habit.title,
          habit.detail,
          habit.reward,
          habit.reward_type,
          habit.reward_name,
          habit.reward_key,
        ]
      );
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
