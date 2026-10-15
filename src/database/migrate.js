require('dotenv').config();

const mysql = require('mysql2/promise');
const env = require('../config/env');
const { roles } = require('../constants/roles');
const { skills } = require('../constants/skills');

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

    CREATE TABLE IF NOT EXISTS companies (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      legal_name VARCHAR(190) NULL,
      code VARCHAR(60) NULL UNIQUE,
      email VARCHAR(190) NULL,
      phone VARCHAR(40) NULL,
      website VARCHAR(190) NULL,
      address TEXT NULL,
      city VARCHAR(120) NULL,
      province VARCHAR(120) NULL,
      country VARCHAR(120) NOT NULL DEFAULT 'Indonesia',
      postal_code VARCHAR(20) NULL,
      tax_number VARCHAR(80) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      role_id BIGINT UNSIGNED NULL,
      company_id BIGINT UNSIGNED NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX users_role_id_index (role_id),
      INDEX users_company_id_index (company_id)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      employee_number VARCHAR(80) NULL UNIQUE,
      position VARCHAR(120) NULL,
      department VARCHAR(120) NULL,
      phone VARCHAR(40) NULL,
      gender ENUM('male', 'female', 'other') NULL,
      birth_date DATE NULL,
      avatar_url VARCHAR(255) NULL,
      address TEXT NULL,
      city VARCHAR(120) NULL,
      province VARCHAR(120) NULL,
      country VARCHAR(120) NOT NULL DEFAULT 'Indonesia',
      postal_code VARCHAR(20) NULL,
      joined_at DATE NULL,
      bio TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT user_profiles_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS user_stats (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      level INT UNSIGNED NOT NULL DEFAULT 1,
      experience INT UNSIGNED NOT NULL DEFAULT 0,
      experience_to_next_level INT UNSIGNED NOT NULL DEFAULT 100,
      health_points INT UNSIGNED NOT NULL DEFAULT 100,
      mana_points INT UNSIGNED NOT NULL DEFAULT 50,
      strength INT UNSIGNED NOT NULL DEFAULT 5,
      intelligence INT UNSIGNED NOT NULL DEFAULT 5,
      agility INT UNSIGNED NOT NULL DEFAULT 5,
      stamina INT UNSIGNED NOT NULL DEFAULT 5,
      luck INT UNSIGNED NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT user_stats_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_experience_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      source VARCHAR(120) NOT NULL,
      amount INT NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX user_experience_logs_user_id_index (user_id),
      INDEX user_experience_logs_source_index (source),
      CONSTRAINT user_experience_logs_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS missions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      mission_date DATE NOT NULL DEFAULT '1970-01-01',
      title VARCHAR(180) NOT NULL,
      detail VARCHAR(255) NULL,
      reward INT UNSIGNED NOT NULL DEFAULT 0,
      reward_type ENUM('xp', 'skill', 'item', 'badge') NOT NULL DEFAULT 'xp',
      reward_name VARCHAR(160) NULL,
      reward_key VARCHAR(100) NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY missions_user_id_title_date_unique (user_id, title, mission_date),
      INDEX missions_user_id_completed_index (user_id, completed),
      CONSTRAINT missions_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_rewards (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      mission_id BIGINT UNSIGNED NOT NULL,
      reward_type ENUM('xp', 'skill', 'item', 'badge') NOT NULL,
      reward_name VARCHAR(160) NOT NULL,
      amount INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_rewards_mission_unique (user_id, mission_id),
      INDEX user_rewards_user_id_index (user_id),
      CONSTRAINT user_rewards_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT user_rewards_mission_id_foreign
        FOREIGN KEY (mission_id) REFERENCES missions(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      item_key VARCHAR(100) NOT NULL,
      name VARCHAR(160) NOT NULL,
      description VARCHAR(255) NULL,
      icon_key VARCHAR(80) NULL,
      quantity INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY user_inventory_user_item_unique (user_id, item_key),
      CONSTRAINT user_inventory_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      badge_key VARCHAR(100) NOT NULL,
      name VARCHAR(160) NOT NULL,
      description VARCHAR(255) NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_badges_user_badge_unique (user_id, badge_key),
      CONSTRAINT user_badges_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      label VARCHAR(120) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      skill_id BIGINT UNSIGNED NOT NULL,
      level INT UNSIGNED NOT NULL DEFAULT 1,
      experience INT UNSIGNED NOT NULL DEFAULT 0,
      experience_to_next_level INT UNSIGNED NOT NULL DEFAULT 50,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY user_skills_user_id_skill_id_unique (user_id, skill_id),
      INDEX user_skills_skill_id_index (skill_id),
      CONSTRAINT user_skills_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT user_skills_skill_id_foreign
        FOREIGN KEY (skill_id) REFERENCES skills(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todo_lists (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(160) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX todo_lists_user_id_index (user_id),
      CONSTRAINT todo_lists_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todo_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      todo_list_id BIGINT UNSIGNED NOT NULL,
      assigned_to BIGINT UNSIGNED NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT NULL,
      status ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
      priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
      due_date DATETIME NULL,
      completed_at DATETIME NULL,
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX todo_items_todo_list_id_index (todo_list_id),
      INDEX todo_items_assigned_to_index (assigned_to),
      INDEX todo_items_status_index (status),
      INDEX todo_items_due_date_index (due_date),
      CONSTRAINT todo_items_todo_list_id_foreign
        FOREIGN KEY (todo_list_id) REFERENCES todo_lists(id)
        ON DELETE CASCADE,
      CONSTRAINT todo_items_assigned_to_foreign
        FOREIGN KEY (assigned_to) REFERENCES users(id)
        ON DELETE SET NULL
    );
  `);

  const [missionColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'missions'
       AND COLUMN_NAME IN ('mission_date', 'reward_type', 'reward_name', 'reward_key')`,
    [env.database.name]
  );
  const missionColumnNames = missionColumns.map((column) => column.COLUMN_NAME);

  if (!missionColumnNames.includes('mission_date')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN mission_date DATE NULL AFTER user_id'
    );
    await connection.query(
      'UPDATE missions SET mission_date = DATE(created_at) WHERE mission_date IS NULL'
    );
    await connection.query(
      "ALTER TABLE missions MODIFY COLUMN mission_date DATE NOT NULL DEFAULT '1970-01-01'"
    );
  }

  if (!missionColumnNames.includes('reward_type')) {
    await connection.query(
      `ALTER TABLE missions
       ADD COLUMN reward_type ENUM('xp', 'skill', 'item', 'badge') NOT NULL DEFAULT 'xp' AFTER reward`
    );
  }

  if (!missionColumnNames.includes('reward_name')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN reward_name VARCHAR(160) NULL AFTER reward_type'
    );
  }

  if (!missionColumnNames.includes('reward_key')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN reward_key VARCHAR(100) NULL AFTER reward_name'
    );
  }

  const [missionIndexes] = await connection.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions'`,
    [env.database.name]
  );
  const missionIndexNames = missionIndexes.map((index) => index.INDEX_NAME);
  if (missionIndexNames.includes('missions_user_id_title_unique')) {
    await connection.query('ALTER TABLE missions DROP INDEX missions_user_id_title_unique');
  }
  if (!missionIndexNames.includes('missions_user_id_title_date_unique')) {
    await connection.query(
      'ALTER TABLE missions ADD UNIQUE KEY missions_user_id_title_date_unique (user_id, title, mission_date)'
    );
  }

  for (const role of roles) {
    await connection.query(
      `INSERT INTO roles (name, label)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [role.name, role.label]
    );
  }

  for (const skill of skills) {
    await connection.query(
      `INSERT INTO skills (name, label, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         description = VALUES(description)`,
      [skill.name, skill.label, skill.description]
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

  const [companyColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'company_id'`,
    [env.database.name]
  );

  if (!companyColumns.length) {
    await connection.query(
      'ALTER TABLE users ADD COLUMN company_id BIGINT UNSIGNED NULL AFTER role_id'
    );
    await connection.query(
      'ALTER TABLE users ADD INDEX users_company_id_index (company_id)'
    );
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

  const [companyConstraints] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'company_id'
       AND REFERENCED_TABLE_NAME = 'companies'`,
    [env.database.name]
  );

  if (!companyConstraints.length) {
    await connection.query(
      `ALTER TABLE users
       ADD CONSTRAINT users_company_id_foreign
       FOREIGN KEY (company_id) REFERENCES companies(id)
       ON DELETE SET NULL`
    );
  }

  await connection.query(
    `UPDATE users
     SET role_id = (SELECT id FROM roles WHERE name = 'staff' LIMIT 1)
     WHERE role_id IS NULL`
  );

  await connection.query(
    `INSERT INTO user_stats (user_id)
     SELECT users.id
     FROM users
     LEFT JOIN user_stats ON user_stats.user_id = users.id
     WHERE user_stats.id IS NULL`
  );

  await connection.query(
    `INSERT INTO user_profiles (user_id)
     SELECT users.id
     FROM users
     LEFT JOIN user_profiles ON user_profiles.user_id = users.id
     WHERE user_profiles.id IS NULL`
  );

  await connection.query(
    `INSERT IGNORE INTO user_skills (user_id, skill_id)
     SELECT users.id, skills.id
     FROM users
     CROSS JOIN skills
     WHERE skills.name IN ('productivity', 'communication')`
  );

  for (const mission of require('../constants/missions').missionSeeds) {
    await connection.query(
      `INSERT INTO missions
         (user_id, mission_date, title, detail, reward, reward_type, reward_name, reward_key)
       SELECT users.id, CURDATE(), ?, ?, ?, ?, ?, ? FROM users
       ON DUPLICATE KEY UPDATE
         detail = VALUES(detail), reward = VALUES(reward),
         reward_type = VALUES(reward_type), reward_name = VALUES(reward_name),
         reward_key = VALUES(reward_key)`,
      [mission.title, mission.detail, mission.reward, mission.reward_type, mission.reward_name, mission.reward_key]
    );
  }

  await connection.end();
  console.log('Migrasi database selesai.');
}

migrate().catch((error) => {
  console.error('Migrasi database gagal:', error.message);
  process.exit(1);
});
