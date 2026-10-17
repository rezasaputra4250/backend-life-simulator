require('dotenv').config();

const pool = require('../config/database');
const { buildDifficultyExperienceSeeds } = require('../constants/difficultyExperience');

async function seedDifficultyExperience(connection = pool) {
  const seeds = buildDifficultyExperienceSeeds();
  for (const seed of seeds) {
    await connection.query(
      `INSERT INTO difficulty_level_experiences
         (difficulty, level, experience_to_next_level)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         experience_to_next_level = VALUES(experience_to_next_level),
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [seed.difficulty, seed.level, seed.experience_to_next_level]
    );
  }
  console.log(`Seeder kurva EXP selesai: ${seeds.length} konfigurasi level.`);
}

module.exports = seedDifficultyExperience;

if (require.main === module) {
  seedDifficultyExperience()
    .catch((error) => {
      console.error('Seeder kurva EXP gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
