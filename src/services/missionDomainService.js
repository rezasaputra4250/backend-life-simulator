async function syncMissionStatus(connection, mission) {
  await connection.query(
    `UPDATE missions
     SET completed = ?, completed_at = ?, failed = ?, failed_at = ?,
         status = CASE WHEN ? = 1 THEN 'completed' ELSE status END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [mission.completed ? 1 : 0, mission.completed_at || null, mission.failed ? 1 : 0,
      mission.failed_at || null, mission.completed ? 1 : 0, mission.id]
  );
}

async function createMission(connection, mission) {
  const [result] = await connection.query(
    `INSERT INTO missions
       (user_id, category, guild_id, mission_date, frequency, scheduled_time,
        title, detail, difficulty, required_class, duration_minutes, target_progress, current_progress,
        status, reward, reward_type, reward_name, reward_key, custom_source,
        grant_player_experience)
     VALUES (?, ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mission.user_id, mission.category, mission.guild_id || null, mission.mission_date || null,
      mission.frequency || 'daily', mission.scheduled_time || null, mission.title,
      mission.detail || null, mission.difficulty || 'easy', mission.required_class || null, mission.duration_minutes || 15,
      mission.target_progress || 1, mission.current_progress || 0, mission.status || 'active',
      mission.reward || 0, mission.reward_type || 'xp', mission.reward_name || null,
      mission.reward_key || null, mission.custom_source ? 1 : 0,
      mission.grant_player_experience === undefined ? 1 : (mission.grant_player_experience ? 1 : 0)]
  );
  return result.insertId;
}

async function createPersonalMission(connection, mission) {
  return createMission(connection, { ...mission, category: 'personal' });
}

async function ensureSystemMission(connection, userId, difficulty, seed) {
  const frequency = seed.frequency || 'daily';
  const missionDate = frequency === 'daily'
    ? new Date().toISOString().slice(0, 10)
    : frequency === 'weekly'
      ? (() => {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + 1);
        return date.toISOString().slice(0, 10);
      })()
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const requiredClass = seed.required_class || null;
  const classCondition = requiredClass ? 'required_class = ?' : 'required_class IS NULL';
  const [rows] = await connection.query(
    `SELECT id FROM missions
     WHERE user_id = ? AND category = 'system' AND title = ? AND frequency = ?
       AND difficulty = ? AND ${classCondition}
       AND mission_date = CASE ? WHEN 'daily' THEN CURDATE()
         WHEN 'weekly' THEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
         ELSE DATE_FORMAT(CURDATE(), '%Y-%m-01') END
       AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
    requiredClass
      ? [userId, seed.title, frequency, difficulty || 'easy', requiredClass, frequency]
      : [userId, seed.title, frequency, difficulty || 'easy', frequency]
  );
  if (rows.length) return rows[0].id;
  return createMission(connection, {
    user_id: userId,
    category: 'system',
    mission_date: missionDate,
    frequency,
    scheduled_time: seed.scheduled_time,
    title: seed.title,
    detail: seed.detail,
    difficulty,
    required_class: seed.required_class,
    duration_minutes: seed.duration_minutes,
    reward: seed.reward,
    reward_type: seed.reward_type,
    reward_name: seed.reward_name,
    reward_key: seed.reward_key,
  });
}

async function createGuildMission(connection, mission) {
  return createMission(connection, {
    ...mission,
    category: 'guild',
    frequency: 'daily',
    target_progress: mission.target_progress || 1,
    current_progress: 0,
    status: 'active',
    grant_player_experience: Boolean(mission.grant_player_experience),
  });
}

async function syncGuildMissionContribution(connection, mission, userId, applied, nextProgress, completed) {
  await connection.query(
    `INSERT INTO mission_contributions (mission_id, user_id, amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount), updated_at = CURRENT_TIMESTAMP`,
    [mission.id, userId, applied]
  );
  await connection.query(
    `UPDATE missions SET current_progress = ?, status = ?, completed = ?, completed_at = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND category = 'guild' AND deleted_at IS NULL`,
    [nextProgress, completed ? 'completed' : 'active', completed ? 1 : 0,
      completed ? new Date() : null, mission.id]
  );
}

module.exports = {
  createPersonalMission,
  createGuildMission,
  ensureSystemMission,
  syncGuildMissionContribution,
  syncMissionStatus,
};
