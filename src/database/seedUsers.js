require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { faker } = require('@faker-js/faker');

async function seedUsers() {
  const userCount = Math.max(10, Number(process.env.SEED_USER_COUNT || 100));
  const demoEmail = process.env.SEED_USER_EMAIL || 'demo@rpg-life.local';
  const password = process.env.SEED_USER_PASSWORD || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const [roles] = await pool.query("SELECT id FROM roles WHERE name = 'staff' LIMIT 1");
  const roleId = roles[0]?.id || null;

  faker.seed(20261017);
  for (let index = 0; index < userCount; index += 1) {
    const isDemo = index === 0;
    const name = isDemo
      ? (process.env.SEED_USER_NAME || 'Petualang Demo')
      : faker.person.fullName();
    const email = isDemo ? demoEmail : `seed-user-${String(index + 1).padStart(3, '0')}@rpg-life.local`;
    const affiliateCode = `SEED${String(index + 1).padStart(6, '0')}`;

    await pool.query(
      `INSERT INTO users (role_id, name, email, password, affiliate_code, difficulty)
       VALUES (?, ?, ?, ?, ?, 'easy')
       ON DUPLICATE KEY UPDATE name = VALUES(name), role_id = VALUES(role_id), password = VALUES(password), updated_at = CURRENT_TIMESTAMP`,
      [roleId, name, email, passwordHash, affiliateCode]
    );
  }

  console.log(`Seeder user selesai: ${userCount} user tersedia. Login demo: ${demoEmail}.`);
}

module.exports = seedUsers;

if (require.main === module) {
  seedUsers()
    .catch((error) => {
      console.error('Seeder user gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
