require('dotenv').config();

const pool = require('../config/database');
const env = require('../config/env');
const seedUsers = require('./seedUsers');
const seedDifficultyExperience = require('./seedDifficultyExperience');
const seedMissions = require('./seedMissions');
const seedMuslimHabits = require('./seedMuslimHabits');
const seedKingdomGuilds = require('./seedKingdomGuilds');

const developmentSeeders = [
  seedDifficultyExperience,
  seedUsers,
  seedMissions,
  seedMuslimHabits,
  seedKingdomGuilds,
];

const productionSeeders = [seedDifficultyExperience];

function isProductionLikeEnvironment() {
  return env.nodeEnv === 'production' || ['staging', 'production'].includes(env.appEnv);
}

async function seed() {
  const productionLike = isProductionLikeEnvironment();
  const seeders = productionLike ? productionSeeders : developmentSeeders;
  const seedProfile = productionLike ? 'production-safe' : 'development';

  console.log(`Menjalankan seed profile ${seedProfile} untuk APP_ENV=${env.appEnv}, NODE_ENV=${env.nodeEnv}.`);
  for (const runSeeder of seeders) {
    await runSeeder();
  }
  console.log(`Semua seeder profile ${seedProfile} selesai.`);
}

seed()
  .catch((error) => {
    console.error('Seeder database gagal:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
