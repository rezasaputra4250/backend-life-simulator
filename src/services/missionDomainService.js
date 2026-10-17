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

async function registerSystemMission(connection, legacyMissionId, mission) {
  return registerMission(connection, 'system_mission_instances', legacyMissionId, mission);
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
  registerSystemMission,
  registerGuildMission,
  syncGuildMissionContribution,
  syncMissionStatus,
};
