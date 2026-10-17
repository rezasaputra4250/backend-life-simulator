require('dotenv').config();

const mysql = require('mysql2/promise');
const env = require('../config/env');
const { roles } = require('../constants/roles');
const { skills } = require('../constants/skills');

function experienceForLevel(level) {
  let requirement = 100;
  for (let currentLevel = 1; currentLevel < Math.max(1, Number(level) || 1); currentLevel += 1) {
    requirement = Math.round(requirement * 1.5);
  }
  return requirement;
}

function levelForExperience(totalExperience) {
  let level = 1;
  let remaining = Math.max(0, Number(totalExperience) || 0);
  while (remaining >= experienceForLevel(level)) {
    remaining -= experienceForLevel(level);
    level += 1;
  }
  return level;
}

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
      affiliate_code VARCHAR(32) NULL UNIQUE,
      referred_by BIGINT UNSIGNED NULL,
      difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX users_role_id_index (role_id),
      INDEX users_company_id_index (company_id),
      INDEX users_referred_by_index (referred_by),
      CONSTRAINT users_referred_by_foreign
        FOREIGN KEY (referred_by) REFERENCES users(id)
        ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      affiliate_user_id BIGINT UNSIGNED NOT NULL,
      referred_user_id BIGINT UNSIGNED NOT NULL,
      referral_code VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY affiliate_referrals_referred_user_unique (referred_user_id),
      INDEX affiliate_referrals_affiliate_user_index (affiliate_user_id),
      CONSTRAINT affiliate_referrals_affiliate_user_foreign
        FOREIGN KEY (affiliate_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT affiliate_referrals_referred_user_foreign
        FOREIGN KEY (referred_user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      requester_id BIGINT UNSIGNED NOT NULL,
      addressee_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY friend_requests_pair_unique (requester_id, addressee_id),
      INDEX friend_requests_addressee_status_index (addressee_id, status),
      CONSTRAINT friend_requests_requester_foreign
        FOREIGN KEY (requester_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT friend_requests_addressee_foreign
        FOREIGN KEY (addressee_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_one_id BIGINT UNSIGNED NOT NULL,
      user_two_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY friendships_pair_unique (user_one_id, user_two_id),
      CONSTRAINT friendships_user_one_foreign
        FOREIGN KEY (user_one_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT friendships_user_two_foreign
        FOREIGN KEY (user_two_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parties (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      max_members INT UNSIGNED NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX parties_owner_id_index (owner_id),
      CONSTRAINT parties_owner_foreign
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS party_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      party_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner', 'member') NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY party_members_pair_unique (party_id, user_id),
      INDEX party_members_user_id_index (user_id),
      CONSTRAINT party_members_party_foreign
        FOREIGN KEY (party_id) REFERENCES parties(id)
        ON DELETE CASCADE,
      CONSTRAINT party_members_user_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guilds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      max_members INT UNSIGNED NOT NULL DEFAULT 20,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX guilds_owner_id_index (owner_id),
      CONSTRAINT guilds_owner_foreign
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guild_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      guild_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner', 'member') NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY guild_members_pair_unique (guild_id, user_id),
      INDEX guild_members_user_id_index (user_id),
      CONSTRAINT guild_members_guild_foreign
        FOREIGN KEY (guild_id) REFERENCES guilds(id)
        ON DELETE CASCADE,
      CONSTRAINT guild_members_user_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guild_invitations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      guild_id BIGINT UNSIGNED NOT NULL,
      inviter_id BIGINT UNSIGNED NOT NULL,
      invitee_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY guild_invitations_pair_unique (guild_id, invitee_id),
      INDEX guild_invitations_invitee_status_index (invitee_id, status),
      CONSTRAINT guild_invitations_guild_foreign
        FOREIGN KEY (guild_id) REFERENCES guilds(id)
        ON DELETE CASCADE,
      CONSTRAINT guild_invitations_inviter_foreign
        FOREIGN KEY (inviter_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT guild_invitations_invitee_foreign
        FOREIGN KEY (invitee_id) REFERENCES users(id)
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
      category ENUM('system', 'personal', 'guild') NOT NULL DEFAULT 'system',
      guild_id BIGINT UNSIGNED NULL,
      target_progress INT UNSIGNED NOT NULL DEFAULT 1,
      current_progress INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
      legacy_guild_mission_id BIGINT UNSIGNED NULL,
      mission_date DATE NOT NULL DEFAULT '1970-01-01',
      frequency ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily',
      scheduled_time TIME NULL,
      title VARCHAR(180) NOT NULL,
      detail VARCHAR(255) NULL,
      reward INT UNSIGNED NOT NULL DEFAULT 0,
      reward_type ENUM('xp', 'skill', 'item', 'badge') NOT NULL DEFAULT 'xp',
      reward_name VARCHAR(160) NULL,
      reward_key VARCHAR(100) NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      failed TINYINT(1) NOT NULL DEFAULT 0,
      failed_at DATETIME NULL,
      grant_player_experience TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY missions_owner_scope_title_date_unique (user_id, category, guild_id, title, mission_date),
      INDEX missions_user_id_completed_index (user_id, completed),
      INDEX missions_guild_status_index (guild_id, status),
      CONSTRAINT missions_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT missions_guild_foreign
        FOREIGN KEY (guild_id) REFERENCES guilds(id)
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

    CREATE TABLE IF NOT EXISTS player_classes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      label VARCHAR(120) NOT NULL,
      description TEXT NULL,
      primary_stat ENUM('strength', 'intelligence', 'agility', 'stamina', 'luck') NOT NULL DEFAULT 'stamina',
      strength_bonus INT NOT NULL DEFAULT 0,
      intelligence_bonus INT NOT NULL DEFAULT 0,
      agility_bonus INT NOT NULL DEFAULT 0,
      stamina_bonus INT NOT NULL DEFAULT 0,
      luck_bonus INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_class_progressions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      class_id BIGINT UNSIGNED NOT NULL,
      level INT UNSIGNED NOT NULL,
      title VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      reward_skill_key VARCHAR(80) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY class_progression_level_unique (class_id, level),
      CONSTRAINT class_progression_class_foreign FOREIGN KEY (class_id) REFERENCES player_classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_classes (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      class_id BIGINT UNSIGNED NOT NULL,
      selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT user_classes_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT user_classes_class_foreign FOREIGN KEY (class_id) REFERENCES player_classes(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS mission_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      detail VARCHAR(255) NULL,
      category ENUM('system', 'personal', 'guild') NOT NULL DEFAULT 'system',
      difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy',
      duration_minutes INT UNSIGNED NOT NULL DEFAULT 15,
      reward_xp INT UNSIGNED NOT NULL DEFAULT 10,
      reward_type ENUM('xp', 'skill', 'item', 'badge') NOT NULL DEFAULT 'xp',
      reward_key VARCHAR(100) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(60) NOT NULL,
      title VARCHAR(160) NOT NULL,
      body VARCHAR(255) NOT NULL,
      data JSON NULL,
      read_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX notifications_user_read_index (user_id, read_at),
      CONSTRAINT notifications_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
      push_enabled TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT notification_preferences_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      source_type VARCHAR(60) NOT NULL,
      source_id BIGINT UNSIGNED NOT NULL,
      reward_type VARCHAR(40) NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY reward_transaction_source_unique (user_id, source_type, source_id, reward_type),
      CONSTRAINT reward_transactions_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS difficulty_configs (
      difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL PRIMARY KEY,
      base_reward_xp INT UNSIGNED NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS experience_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      source_type VARCHAR(60) NOT NULL,
      source_id BIGINT UNSIGNED NULL,
      amount INT NOT NULL,
      reason VARCHAR(255) NULL,
      idempotency_key VARCHAR(190) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT experience_transactions_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX experience_transactions_user_created_index (user_id, created_at),
      INDEX experience_transactions_source_index (source_type, source_id)
    );

    CREATE TABLE IF NOT EXISTS guild_missions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      guild_id BIGINT UNSIGNED NOT NULL,
      creator_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(180) NOT NULL,
      detail VARCHAR(255) NULL,
      difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy',
      target_progress INT UNSIGNED NOT NULL DEFAULT 1,
      current_progress INT UNSIGNED NOT NULL DEFAULT 0,
      reward_xp INT UNSIGNED NOT NULL DEFAULT 25,
      mission_date DATE NOT NULL,
      status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX guild_missions_guild_status_index (guild_id, status),
      CONSTRAINT guild_missions_guild_foreign FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
      CONSTRAINT guild_missions_creator_foreign FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guild_mission_contributions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      mission_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      amount INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY guild_mission_user_unique (mission_id, user_id),
      CONSTRAINT guild_mission_contributions_mission_foreign FOREIGN KEY (mission_id) REFERENCES guild_missions(id) ON DELETE CASCADE,
      CONSTRAINT guild_mission_contributions_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mission_contributions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      mission_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      amount INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY mission_contributions_mission_user_unique (mission_id, user_id),
      CONSTRAINT mission_contributions_mission_foreign FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      CONSTRAINT mission_contributions_user_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Keep timestamps and soft deletes consistent for new and existing tables.
  const managedTables = [
    'roles', 'companies', 'users', 'user_profiles', 'affiliate_referrals',
    'friend_requests', 'friendships', 'parties', 'party_members', 'guilds',
    'guild_members', 'guild_invitations', 'password_resets', 'user_stats',
    'user_experience_logs', 'missions', 'user_rewards', 'user_inventory',
    'user_badges', 'skills', 'user_skills', 'todo_lists', 'todo_items',
    'player_classes', 'player_class_progressions', 'user_classes',
    'mission_templates', 'notifications', 'notification_preferences',
    'reward_transactions', 'difficulty_configs', 'experience_transactions',
    'guild_missions', 'guild_mission_contributions', 'mission_contributions',
  ];

  for (const tableName of managedTables) {
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         AND COLUMN_NAME IN ('created_at', 'updated_at', 'deleted_at')`,
      [env.database.name, tableName]
    );
    const columnNames = columns.map((column) => column.COLUMN_NAME);

    if (!columnNames.includes('created_at')) {
      await connection.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
      );
    }
    if (!columnNames.includes('updated_at')) {
      await connection.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
      );
    }
    if (!columnNames.includes('deleted_at')) {
      await connection.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`
      );
    }

    const [deletedAtIndexes] = await connection.query(
      `SELECT DISTINCT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [env.database.name, tableName, `${tableName}_deleted_at_index`]
    );
    if (!deletedAtIndexes.length) {
      await connection.query(
        `ALTER TABLE \`${tableName}\` ADD INDEX \`${tableName}_deleted_at_index\` (deleted_at)`
      );
    }
  }

  const [userDifficultyColumns] = await connection.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'difficulty'`,
    [env.database.name]
  );
  if (!userDifficultyColumns.length) {
    await connection.query(
      "ALTER TABLE users ADD COLUMN difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy'"
    );
  } else {
    await connection.query("UPDATE users SET difficulty = 'normal' WHERE difficulty = 'medium'");
    await connection.query("UPDATE users SET difficulty = 'expert' WHERE difficulty = 'epic'");
    if (userDifficultyColumns[0].COLUMN_TYPE !== "enum('easy','normal','hard','expert')") {
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy'"
      );
    }
  }

  const difficultyTables = ['missions', 'mission_templates', 'guild_missions'];
  for (const tableName of difficultyTables) {
    const [difficultyColumns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'difficulty'`,
      [env.database.name, tableName]
    );
    if (difficultyColumns.length) {
      await connection.query(`UPDATE \`${tableName}\` SET difficulty = 'normal' WHERE difficulty = 'medium'`);
      await connection.query(`UPDATE \`${tableName}\` SET difficulty = 'expert' WHERE difficulty = 'epic'`);
      if (difficultyColumns[0].COLUMN_TYPE !== "enum('easy','normal','hard','expert')") {
        await connection.query(
          `ALTER TABLE \`${tableName}\` MODIFY COLUMN difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy'`
        );
      }
    }
  }

  const [missionRewardColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions' AND COLUMN_NAME = 'grant_player_experience'`,
    [env.database.name]
  );
  if (!missionRewardColumns.length) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN grant_player_experience TINYINT(1) NOT NULL DEFAULT 1'
    );
  }
  const [missionCategoryColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions' AND COLUMN_NAME = 'category'`,
    [env.database.name]
  );
  if (missionCategoryColumns.length) {
    await connection.query("UPDATE missions SET grant_player_experience = 0 WHERE category = 'guild'");
  }

  await connection.query(
    `INSERT INTO difficulty_configs (difficulty, base_reward_xp)
     VALUES ('easy', 100), ('normal', 50), ('hard', 10), ('expert', 5)
     ON DUPLICATE KEY UPDATE base_reward_xp = VALUES(base_reward_xp), is_active = 1`
  );

  const [missionExtraColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions'
       AND COLUMN_NAME IN ('difficulty', 'duration_minutes', 'template_id', 'custom_source')`,
    [env.database.name]
  );
  const extraNames = missionExtraColumns.map((column) => column.COLUMN_NAME);
  if (!extraNames.includes('difficulty')) {
    await connection.query("ALTER TABLE missions ADD COLUMN difficulty ENUM('easy', 'normal', 'hard', 'expert') NOT NULL DEFAULT 'easy' AFTER detail");
  }
  if (!extraNames.includes('duration_minutes')) {
    await connection.query('ALTER TABLE missions ADD COLUMN duration_minutes INT UNSIGNED NOT NULL DEFAULT 15 AFTER difficulty');
  }
  if (!extraNames.includes('template_id')) {
    await connection.query('ALTER TABLE missions ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER user_id');
  }
  if (!extraNames.includes('custom_source')) {
    await connection.query("ALTER TABLE missions ADD COLUMN custom_source TINYINT(1) NOT NULL DEFAULT 0 AFTER template_id");
  }

  const classSeeds = [
    ['warrior', 'Warrior', 'Petarung yang unggul dalam kekuatan dan stamina.', 'strength', 3, 0, 0, 2, 0],
    ['scholar', 'Scholar', 'Pembelajar yang unggul dalam kecerdasan dan pemecahan masalah.', 'intelligence', 0, 3, 1, 0, 1],
    ['artisan', 'Artisan', 'Pencipta yang tekun, lincah, dan konsisten.', 'agility', 0, 1, 3, 1, 0],
  ];
  for (const seed of classSeeds) {
    await connection.query(
      `INSERT INTO player_classes
       (name, label, description, primary_stat, strength_bonus, intelligence_bonus, agility_bonus, stamina_bonus, luck_bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), primary_stat = VALUES(primary_stat),
         strength_bonus = VALUES(strength_bonus), intelligence_bonus = VALUES(intelligence_bonus), agility_bonus = VALUES(agility_bonus),
         stamina_bonus = VALUES(stamina_bonus), luck_bonus = VALUES(luck_bonus)`,
      seed
    );
  }

  const missionTemplates = [
    ['Fokus kerja', 'Selesaikan satu pekerjaan penting tanpa distraksi.', 'personal', 'normal', 30, 50],
    ['Latihan pagi', 'Bergerak aktif selama minimal 20 menit.', 'personal', 'easy', 20, 25],
    ['Belajar skill baru', 'Luangkan waktu untuk belajar dan mencatat hal penting.', 'personal', 'normal', 25, 50],
    ['Refleksi harian', 'Tulis jurnal singkat tentang progres hari ini.', 'personal', 'easy', 10, 25],
  ];
  for (const template of missionTemplates) {
    await connection.query(
      `INSERT INTO mission_templates (title, detail, category, difficulty, duration_minutes, reward_xp)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM mission_templates WHERE title = ? LIMIT 1)`,
      [...template, template[0]]
    );
  }

  await connection.query(
    `INSERT INTO notification_preferences (user_id)
     SELECT users.id FROM users
     LEFT JOIN notification_preferences ON notification_preferences.user_id = users.id
     WHERE notification_preferences.user_id IS NULL`
  );

  const [missionColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'missions'
       AND COLUMN_NAME IN ('category', 'mission_date', 'frequency', 'scheduled_time', 'reward_type', 'reward_name', 'reward_key', 'failed', 'failed_at')`,
    [env.database.name]
  );
  const missionColumnNames = missionColumns.map((column) => column.COLUMN_NAME);

  if (!missionColumnNames.includes('category')) {
    await connection.query(
      "ALTER TABLE missions ADD COLUMN category ENUM('system', 'personal', 'guild') NOT NULL DEFAULT 'system' AFTER user_id"
    );
  }

  const [sharedMissionColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'missions'
       AND COLUMN_NAME IN ('guild_id', 'target_progress', 'current_progress', 'status', 'legacy_guild_mission_id')`,
    [env.database.name]
  );
  const sharedMissionColumnNames = sharedMissionColumns.map((column) => column.COLUMN_NAME);

  if (!sharedMissionColumnNames.includes('guild_id')) {
    await connection.query('ALTER TABLE missions ADD COLUMN guild_id BIGINT UNSIGNED NULL AFTER category');
  }
  if (!sharedMissionColumnNames.includes('target_progress')) {
    await connection.query('ALTER TABLE missions ADD COLUMN target_progress INT UNSIGNED NOT NULL DEFAULT 1 AFTER guild_id');
  }
  if (!sharedMissionColumnNames.includes('current_progress')) {
    await connection.query('ALTER TABLE missions ADD COLUMN current_progress INT UNSIGNED NOT NULL DEFAULT 0 AFTER target_progress');
  }
  if (!sharedMissionColumnNames.includes('status')) {
    await connection.query("ALTER TABLE missions ADD COLUMN status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active' AFTER current_progress");
  }
  if (!sharedMissionColumnNames.includes('legacy_guild_mission_id')) {
    await connection.query('ALTER TABLE missions ADD COLUMN legacy_guild_mission_id BIGINT UNSIGNED NULL AFTER status');
  }

  const [missionGuildIndexes] = await connection.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions' AND INDEX_NAME = 'missions_guild_status_index'`,
    [env.database.name]
  );
  if (!missionGuildIndexes.length) {
    await connection.query('ALTER TABLE missions ADD INDEX missions_guild_status_index (guild_id, status)');
  }

  const [missionGuildForeignKeys] = await connection.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'missions' AND COLUMN_NAME = 'guild_id' AND REFERENCED_TABLE_NAME = 'guilds'`,
    [env.database.name]
  );
  if (!missionGuildForeignKeys.length) {
    await connection.query('ALTER TABLE missions ADD CONSTRAINT missions_guild_foreign FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE');
  }

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

  if (!missionColumnNames.includes('scheduled_time')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN scheduled_time TIME NULL AFTER mission_date'
    );
  }

  if (!missionColumnNames.includes('frequency')) {
    await connection.query(
      "ALTER TABLE missions ADD COLUMN frequency ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily' AFTER mission_date"
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

  if (!missionColumnNames.includes('failed')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN failed TINYINT(1) NOT NULL DEFAULT 0 AFTER completed_at'
    );
  }

  if (!missionColumnNames.includes('failed_at')) {
    await connection.query(
      'ALTER TABLE missions ADD COLUMN failed_at DATETIME NULL AFTER failed'
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
  if (missionIndexNames.includes('missions_user_id_title_date_unique')) {
    await connection.query('ALTER TABLE missions DROP INDEX missions_user_id_title_date_unique');
  }
  if (!missionIndexNames.includes('missions_owner_scope_title_date_unique')) {
    await connection.query(
      'ALTER TABLE missions ADD UNIQUE KEY missions_owner_scope_title_date_unique (user_id, category, guild_id, title, mission_date)'
    );
  }

  await connection.query(
    `INSERT IGNORE INTO missions
       (user_id, category, guild_id, target_progress, current_progress, status, legacy_guild_mission_id,
        mission_date, frequency, title, detail, difficulty, reward, reward_type, reward_name, reward_key, custom_source, grant_player_experience,
        completed, completed_at)
     SELECT guild_missions.creator_id, 'guild', guild_missions.guild_id,
            guild_missions.target_progress, guild_missions.current_progress, guild_missions.status, guild_missions.id,
            guild_missions.mission_date, 'daily', guild_missions.title, guild_missions.detail, guild_missions.difficulty,
            guild_missions.reward_xp, 'xp', CONCAT(guild_missions.reward_xp, ' XP untuk kontribusi'), 'xp', 1, 0,
            IF(guild_missions.status = 'completed', 1, 0), guild_missions.completed_at
     FROM guild_missions
     LEFT JOIN missions ON missions.legacy_guild_mission_id = guild_missions.id
     WHERE missions.id IS NULL`
  );

  await connection.query(
    `INSERT IGNORE INTO mission_contributions (mission_id, user_id, amount)
     SELECT missions.id, guild_mission_contributions.user_id, guild_mission_contributions.amount
     FROM guild_mission_contributions
     INNER JOIN missions ON missions.legacy_guild_mission_id = guild_mission_contributions.mission_id`
  );

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

  const [affiliateColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('affiliate_code', 'referred_by')`,
    [env.database.name]
  );
  const affiliateColumnNames = affiliateColumns.map((column) => column.COLUMN_NAME);

  if (!affiliateColumnNames.includes('affiliate_code')) {
    await connection.query(
      'ALTER TABLE users ADD COLUMN affiliate_code VARCHAR(32) NULL UNIQUE AFTER password'
    );
  }

  if (!affiliateColumnNames.includes('referred_by')) {
    await connection.query(
      'ALTER TABLE users ADD COLUMN referred_by BIGINT UNSIGNED NULL AFTER affiliate_code'
    );
    await connection.query('ALTER TABLE users ADD INDEX users_referred_by_index (referred_by)');
  }

  const [affiliateConstraints] = await connection.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'referred_by'
       AND REFERENCED_TABLE_NAME = 'users'`,
    [env.database.name]
  );

  if (!affiliateConstraints.length) {
    await connection.query(
      `ALTER TABLE users
       ADD CONSTRAINT users_referred_by_foreign
       FOREIGN KEY (referred_by) REFERENCES users(id)
       ON DELETE SET NULL`
    );
  }

  await connection.query(
    `UPDATE users
     SET affiliate_code = CONCAT('AFF', LPAD(id, 6, '0'))
     WHERE affiliate_code IS NULL`
  );

  await connection.query(
    `UPDATE users
     SET affiliate_code = REPLACE(affiliate_code, 'REF-', '')
     WHERE affiliate_code LIKE 'REF-%'`
  );

  await connection.query(
    `UPDATE affiliate_referrals
     INNER JOIN users ON users.id = affiliate_referrals.affiliate_user_id
     SET affiliate_referrals.referral_code = users.affiliate_code`
  );

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

  const [existingStats] = await connection.query(
    'SELECT user_id, experience FROM user_stats'
  );
  for (const stats of existingStats) {
    const level = levelForExperience(stats.experience);
    await connection.query(
      `UPDATE user_stats
       SET level = ?, experience_to_next_level = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [level, experienceForLevel(level), stats.user_id]
    );
  }

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

  for (const mission of require('../constants/missions').allMissionSeeds) {
    await connection.query(
      `INSERT INTO missions
         (user_id, difficulty, mission_date, frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key)
       SELECT users.id, users.difficulty,
              CASE ?
                WHEN 'daily' THEN CURDATE()
                WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01')
              END,
              ?, ?, ?, ?, ?, ?, ?, ? FROM users
       ON DUPLICATE KEY UPDATE
         frequency = VALUES(frequency), scheduled_time = VALUES(scheduled_time), detail = VALUES(detail)`,
      [mission.frequency || 'daily', mission.frequency || 'daily', mission.scheduled_time, mission.title, mission.detail, mission.reward, mission.reward_type, mission.reward_name, mission.reward_key]
    );
  }

  await connection.end();
  console.log('Migrasi database selesai.');
}

migrate().catch((error) => {
  console.error('Migrasi database gagal:', error.message);
  process.exit(1);
});
