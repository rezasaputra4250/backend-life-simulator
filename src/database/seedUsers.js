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
  const [legacySeedUsers] = await pool.query(
    `SELECT id
     FROM users
     WHERE email = ? OR email LIKE 'seed-user-%@rpg-life.local'
     ORDER BY id ASC`,
    [demoEmail]
  );

  // Free the old seeded email addresses first so existing local seed data can
  // be renamed to test1@example.com ... test100@example.com without clashes.
  for (const user of legacySeedUsers) {
    await pool.query(
      "UPDATE users SET email = CONCAT('legacy-seed-', id, '@rpg-life.local') WHERE id = ?",
      [user.id]
    );
  }

  faker.seed(20261017);
  for (let index = 0; index < userCount; index += 1) {
    const isDemo = index === 0;
    const name = isDemo
      ? (process.env.SEED_USER_NAME || 'Petualang Demo')
      : faker.person.fullName();
    const email = `test${index + 1}@example.com`;
    const affiliateCode = `SEED${String(index + 1).padStart(6, '0')}`;
    const legacyUser = legacySeedUsers[index];

    if (legacyUser) {
      await pool.query(
        `UPDATE users
         SET role_id = ?, name = ?, email = ?, password = ?, affiliate_code = ?, difficulty = 'easy', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [roleId, name, email, passwordHash, affiliateCode, legacyUser.id]
      );
      continue;
    }

    await pool.query(
      `INSERT INTO users (role_id, name, email, password, affiliate_code, difficulty)
       VALUES (?, ?, ?, ?, ?, 'easy')
       ON DUPLICATE KEY UPDATE name = VALUES(name), role_id = VALUES(role_id), password = VALUES(password), updated_at = CURRENT_TIMESTAMP`,
      [roleId, name, email, passwordHash, affiliateCode]
    );
  }

  await pool.query(
    `INSERT INTO user_classes (user_id, class_id)
     SELECT users.id, (SELECT id FROM player_classes WHERE is_active = 1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 1)
     FROM users
     WHERE users.email LIKE 'test%@example.com'
       AND users.deleted_at IS NULL
     ON DUPLICATE KEY UPDATE deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`
  );

  console.log(`Seeder user selesai: ${userCount} user tersedia dengan email test1@example.com sampai test${userCount}@example.com.`);
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
