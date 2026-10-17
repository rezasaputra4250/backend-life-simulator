const DOMAIN_TABLES = {
  system: 'system_mission_instances',
  personal: 'personal_missions',
};

function tableForCategory(category) {
  return DOMAIN_TABLES[category] || null;
}

async function syncMissionStatus(connection, mission) {
  const tableName = tableForCategory(mission.category);
  if (!tableName) return;

  await connection.query(
    `UPDATE ${tableName}
     SET completed = ?, completed_at = ?, failed = ?, failed_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE legacy_mission_id = ? AND deleted_at IS NULL`,
    [
      mission.completed ? 1 : 0,
      mission.completed_at || null,
      mission.failed ? 1 : 0,
      mission.failed_at || null,
      mission.id,
    ]
  );
}

async function registerMission(connection, tableName, legacyMissionId, mission) {
  await connection.query(
    `INSERT IGNORE INTO ${tableName}
       (legacy_mission_id, user_id, difficulty, mission_date, frequency, scheduled_time,
        title, detail, duration_minutes, reward, reward_type, reward_name, reward_key,
        completed, completed_at, failed, failed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      legacyMissionId,
      mission.user_id,
      mission.difficulty,
      mission.mission_date,
      mission.frequency,
      mission.scheduled_time || null,
      mission.title,
      mission.detail || null,
      mission.duration_minutes || 15,
      mission.reward || 0,
      mission.reward_type,
      mission.reward_name || null,
      mission.reward_key || null,
      mission.completed ? 1 : 0,
      mission.completed_at || null,
      mission.failed ? 1 : 0,
      mission.failed_at || null,
    ]
  );
}

async function registerPersonalMission(connection, legacyMissionId, mission) {
  return registerMission(connection, 'personal_missions', legacyMissionId, mission);
}

async function createPersonalMission(connection, mission) {
  const [domainResult] = await connection.query(
    `INSERT INTO personal_missions
       (user_id, difficulty, mission_date, frequency, scheduled_time, title, detail,
        duration_minutes, reward, reward_type, reward_name, reward_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mission.user_id,
      mission.difficulty,
      mission.mission_date,
      mission.frequency,
      mission.scheduled_time || null,
      mission.title,
      mission.detail || null,
      mission.duration_minutes || 15,
      mission.reward || 0,
      mission.reward_type,
      mission.reward_name || null,
      mission.reward_key || null,
    ]
  );

  const [projectionResult] = await connection.query(
    `INSERT INTO missions
       (user_id, category, mission_date, frequency, scheduled_time, title, detail, difficulty,
        duration_minutes, reward, reward_type, reward_name, reward_key, custom_source)
     VALUES (?, 'personal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      mission.user_id,
      mission.mission_date,
      mission.frequency,
      mission.scheduled_time || null,
      mission.title,
      mission.detail || null,
      mission.difficulty,
      mission.duration_minutes || 15,
      mission.reward || 0,
      mission.reward_type,
      mission.reward_name || null,
      mission.reward_key || null,
    ]
  );

  await connection.query(
    'UPDATE personal_missions SET legacy_mission_id = ? WHERE id = ? AND legacy_mission_id IS NULL',
    [projectionResult.insertId, domainResult.insertId]
  );

  return projectionResult.insertId;
}

async function registerSystemMission(connection, legacyMissionId, mission) {
  return registerMission(connection, 'system_mission_instances', legacyMissionId, mission);
}

async function ensureSystemMission(connection, userId, difficulty, seed) {
  const frequency = seed.frequency || 'daily';
  const [domainRows] = await connection.query(
    `SELECT id, legacy_mission_id
     FROM system_mission_instances
     WHERE user_id = ? AND title = ? AND frequency = ?
       AND mission_date = CASE ?
         WHEN 'daily' THEN CURDATE()
         WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
         ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01')
       END
       AND deleted_at IS NULL
     LIMIT 1 FOR UPDATE`,
    [userId, seed.title, frequency, frequency]
  );
  if (domainRows.length) return domainRows[0].legacy_mission_id;

  const [legacyRows] = await connection.query(
    `SELECT id, user_id, difficulty, mission_date, frequency, scheduled_time, title, detail,
            duration_minutes, reward, reward_type, reward_name, reward_key,
            completed, completed_at, failed, failed_at
     FROM missions
     WHERE user_id = ? AND category = 'system' AND title = ? AND frequency = ?
       AND mission_date = CASE ?
         WHEN 'daily' THEN CURDATE()
         WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
         ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01')
       END
       AND deleted_at IS NULL
     LIMIT 1 FOR UPDATE`,
    [userId, seed.title, frequency, frequency]
  );
  if (legacyRows.length) {
    await registerSystemMission(connection, legacyRows[0].id, legacyRows[0]);
    return legacyRows[0].id;
  }

  const [domainResult] = await connection.query(
    `INSERT INTO system_mission_instances
       (user_id, category, difficulty, mission_date, frequency, scheduled_time, title, detail,
        duration_minutes, reward, reward_type, reward_name, reward_key)
     VALUES (?, 'system', ?, CASE ?
       WHEN 'daily' THEN CURDATE()
       WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
       ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01')
     END, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      difficulty,
      frequency,
      frequency,
      seed.scheduled_time || null,
      seed.title,
      seed.detail || null,
      seed.duration_minutes || 15,
      seed.reward || 0,
      seed.reward_type,
      seed.reward_name || null,
      seed.reward_key || null,
    ]
  );
  const [projectionResult] = await connection.query(
    `INSERT INTO missions
       (user_id, category, difficulty, mission_date, frequency, scheduled_time, title, detail,
        duration_minutes, reward, reward_type, reward_name, reward_key)
     VALUES (?, 'system', ?, CASE ?
       WHEN 'daily' THEN CURDATE()
       WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
       ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01')
     END, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      difficulty,
      frequency,
      frequency,
      seed.scheduled_time || null,
      seed.title,
      seed.detail || null,
      seed.duration_minutes || 15,
      seed.reward || 0,
      seed.reward_type,
      seed.reward_name || null,
      seed.reward_key || null,
    ]
  );
  await connection.query(
    'UPDATE system_mission_instances SET legacy_mission_id = ? WHERE id = ? AND legacy_mission_id IS NULL',
    [projectionResult.insertId, domainResult.insertId]
  );
  return projectionResult.insertId;
}

async function registerGuildMission(connection, legacyMissionId, mission) {
  await connection.query(
    `INSERT IGNORE INTO guild_missions
       (legacy_mission_id, guild_id, creator_id, title, detail, difficulty, target_progress,
        current_progress, reward_xp, grant_player_experience, scheduled_time, reward_type,
        reward_name, reward_key, mission_date, status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      legacyMissionId,
      mission.guild_id,
      mission.user_id,
      mission.title,
      mission.detail || null,
      mission.difficulty,
      mission.target_progress || 1,
      mission.current_progress || 0,
      mission.reward || 0,
      mission.grant_player_experience ? 1 : 0,
      mission.scheduled_time || null,
      mission.reward_type || 'xp',
      mission.reward_name || null,
      mission.reward_key || null,
      mission.mission_date,
      mission.status || 'active',
      mission.completed_at || null,
    ]
  );
}

async function createGuildMission(connection, mission) {
  const [domainResult] = await connection.query(
    `INSERT INTO guild_missions
       (guild_id, creator_id, title, detail, difficulty, target_progress, current_progress,
        reward_xp, grant_player_experience, scheduled_time, reward_type, reward_name, reward_key,
        mission_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      mission.guild_id,
      mission.user_id,
      mission.title,
      mission.detail || null,
      mission.difficulty,
      mission.target_progress || 1,
      mission.reward || 0,
      mission.grant_player_experience ? 1 : 0,
      mission.scheduled_time || null,
      mission.reward_type || 'xp',
      mission.reward_name || null,
      mission.reward_key || null,
      mission.mission_date,
    ]
  );

  const [projectionResult] = await connection.query(
    `INSERT INTO missions
       (user_id, category, guild_id, mission_date, frequency, scheduled_time, title, detail, difficulty,
        target_progress, current_progress, status, reward, reward_type, reward_name, reward_key,
        custom_source, grant_player_experience)
     VALUES (?, 'guild', ?, ?, 'daily', ?, ?, ?, ?, ?, 0, 'active', ?, ?, ?, ?, 1, ?)`,
    [
      mission.user_id,
      mission.guild_id,
      mission.mission_date,
      mission.scheduled_time || null,
      mission.title,
      mission.detail || null,
      mission.difficulty,
      mission.target_progress || 1,
      mission.reward || 0,
      mission.reward_type || 'xp',
      mission.reward_name || null,
      mission.reward_key || null,
      mission.grant_player_experience ? 1 : 0,
    ]
  );

  await connection.query(
    'UPDATE guild_missions SET legacy_mission_id = ? WHERE id = ? AND legacy_mission_id IS NULL',
    [projectionResult.insertId, domainResult.insertId]
  );

  return projectionResult.insertId;
}

async function syncGuildMissionContribution(connection, mission, userId, applied, nextProgress, completed) {
  const [domainRows] = await connection.query(
    'SELECT id FROM guild_missions WHERE legacy_mission_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
    [mission.id]
  );
  if (!domainRows.length) return;

  const domainId = domainRows[0].id;
  await connection.query(
    `INSERT INTO guild_mission_contributions (mission_id, user_id, amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount), updated_at = CURRENT_TIMESTAMP`,
    [domainId, userId, applied]
  );
  await connection.query(
    `UPDATE guild_missions
     SET current_progress = ?, status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [nextProgress, completed ? 'completed' : 'active', completed ? new Date() : null, domainId]
  );
}

module.exports = {
  registerPersonalMission,
  createPersonalMission,
  registerSystemMission,
  ensureSystemMission,
  registerGuildMission,
  createGuildMission,
  syncGuildMissionContribution,
  syncMissionStatus,
};
