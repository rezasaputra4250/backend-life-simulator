require('dotenv').config();

const pool = require('../config/database');
const { missionSeeds } = require('../constants/missions');

async function seedMissions() {
  const [users] = await pool.query('SELECT id FROM users ORDER BY id ASC');

  for (const user of users) {
    for (const mission of missionSeeds) {
      await pool.query(
        `INSERT INTO missions
           (user_id, mission_date, title, detail, reward, reward_type, reward_name, reward_key)
         VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           detail = VALUES(detail), reward = VALUES(reward),
           reward_type = VALUES(reward_type), reward_name = VALUES(reward_name),
           reward_key = VALUES(reward_key)`,
        [user.id, mission.title, mission.detail, mission.reward, mission.reward_type, mission.reward_name, mission.reward_key]
      );
    }
  }

  await pool.end();
  console.log(`Seeder misi selesai untuk ${users.length} pengguna.`);
}

seedMissions().catch(async (error) => {
  console.error('Seeder misi gagal:', error.message);
  await pool.end();
  process.exit(1);
});
