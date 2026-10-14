require('dotenv').config();

const mysql = require('mysql2/promise');
const env = require('../config/env');
const { roles } = require('../constants/roles');

async function migrate() {
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.database.name}\``);
  await connection.query(`USE \`${env.database.name}\``);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL UNIQUE,
      label VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      role_id BIGINT UNSIGNED NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX users_role_id_index (role_id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX password_resets_token_hash_index (token_hash),
      CONSTRAINT password_resets_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );
  `);

  for (const role of roles) {
    await connection.query(
      `INSERT INTO roles (name, label)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [role.name, role.label]
    );
  }

  const [roleColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'role_id'`,
    [env.database.name]
  );

  if (!roleColumns.length) {
    await connection.query(
      'ALTER TABLE users ADD COLUMN role_id BIGINT UNSIGNED NULL AFTER id'
    );
    await connection.query('ALTER TABLE users ADD INDEX users_role_id_index (role_id)');
  }

  const [constraints] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'role_id'
       AND REFERENCED_TABLE_NAME = 'roles'`,
    [env.database.name]
  );

  if (!constraints.length) {
    await connection.query(
      `ALTER TABLE users
       ADD CONSTRAINT users_role_id_foreign
       FOREIGN KEY (role_id) REFERENCES roles(id)
       ON DELETE SET NULL`
    );
  }

  await connection.query(
    `UPDATE users
     SET role_id = (SELECT id FROM roles WHERE name = 'staff' LIMIT 1)
     WHERE role_id IS NULL`
  );

  await connection.end();
  console.log('Migrasi database selesai.');
}

migrate().catch((error) => {
  console.error('Migrasi database gagal:', error.message);
  process.exit(1);
});
