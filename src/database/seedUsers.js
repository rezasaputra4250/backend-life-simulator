require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seedUsers() {
  const email = process.env.SEED_USER_EMAIL || 'demo@rpg-life.local';
  const password = process.env.SEED_USER_PASSWORD || 'Password123!';
  const name = process.env.SEED_USER_NAME || 'Petualang Demo';
  const passwordHash = await bcrypt.hash(password, 10);
  const [roles] = await pool.query("SELECT id FROM roles WHERE name = 'staff' LIMIT 1");

  await pool.query(
    `INSERT INTO users (role_id, name, email, password, affiliate_code, difficulty)
     VALUES (?, ?, ?, ?, 'DEMO000001', 'easy')
     ON DUPLICATE KEY UPDATE name = VALUES(name), role_id = VALUES(role_id), updated_at = CURRENT_TIMESTAMP`,
    [roles[0]?.id || null, name, email, passwordHash]
  );

  console.log(`Seeder user selesai: ${email}.`);
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
