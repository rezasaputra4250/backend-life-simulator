require('dotenv').config();

const pool = require('../config/database');
const seedUsers = require('./seedUsers');
const seedDifficultyExperience = require('./seedDifficultyExperience');
const seedMissions = require('./seedMissions');
const seedMuslimHabits = require('./seedMuslimHabits');
const seedKingdomGuilds = require('./seedKingdomGuilds');

async function seed() {
  await seedDifficultyExperience();
  await seedUsers();
  await seedMissions();
  await seedMuslimHabits();
  await seedKingdomGuilds();
  console.log('Semua seeder selesai.');
}

seed()
  .catch((error) => {
    console.error('Seeder database gagal:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
