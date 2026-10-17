require('dotenv').config();

const pool = require('../config/database');
const { allMissionSeeds } = require('../constants/missions');
const { ensureSystemMission } = require('../services/missionDomainService');

async function seedMissions() {
  const [users] = await pool.query('SELECT id, difficulty FROM users WHERE deleted_at IS NULL ORDER BY id ASC');

  for (const user of users) {
    for (const mission of allMissionSeeds) {
      await ensureSystemMission(pool, user.id, user.difficulty || 'easy', {
        ...mission,
        frequency: mission.frequency || 'daily',
        duration_minutes: mission.duration_minutes || 15,
      });
    }
  }

  console.log(`Seeder misi selesai untuk ${users.length} pengguna.`);
}

module.exports = seedMissions;

if (require.main === module) {
  seedMissions()
    .catch((error) => {
      console.error('Seeder misi gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
