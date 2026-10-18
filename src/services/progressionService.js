const pool = require('../config/database');
const { experienceForDifficultyLevel } = require('../constants/difficultyExperience');

function experienceForLevel(level, difficulty = 'easy', curve = null) {
  const targetLevel = Math.max(1, Math.min(100, Number(level) || 1));
  const curveValue = curve?.find((entry) => Number(entry.level) === targetLevel)?.experience_to_next_level;
  return curveValue === undefined
    ? experienceForDifficultyLevel(targetLevel, difficulty)
    : Number(curveValue);
}

function levelForExperience(totalExperience, difficulty = 'easy', curve = null) {
  let level = 1;
  let remaining = Math.max(0, Number(totalExperience) || 0);
  while (level < 100 && remaining >= experienceForLevel(level, difficulty, curve)) {
    remaining -= experienceForLevel(level, difficulty, curve);
    level += 1;
  }
  return level;
}

function parseExperienceCurve(value) {
  if (!value) return null;
  return String(value).split('|').map((entry) => {
    const [level, experience] = entry.split(':').map(Number);
    return { level, experience_to_next_level: experience };
  }).filter((entry) => Number.isFinite(entry.level) && Number.isFinite(entry.experience_to_next_level));
}

async function grantExperience(connection, userId, amount, source, description, options = {}) {
  const safeAmount = Math.max(-1000000, Math.min(Number(amount) || 0, 1000000));
  if (!safeAmount) return { amount: 0, levelUp: false };

  const sourceId = options.sourceId ?? null;
  const idempotencyKey = options.idempotencyKey
    ? `${userId}:${options.idempotencyKey}`
    : `${userId}:${source}:${sourceId ?? description ?? 'manual'}`;
  const [ledgerResult] = await connection.query(
    `INSERT IGNORE INTO experience_transactions
       (user_id, source_type, source_id, amount, reason, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, source, sourceId, safeAmount, description || null, idempotencyKey]
  );
  if (!ledgerResult.affectedRows) return { amount: 0, levelUp: false, duplicate: true };

  const [beforeRows] = await connection.query(
    `SELECT stats.level, stats.experience, users.difficulty,
            (SELECT GROUP_CONCAT(CONCAT(curve.level, ':', curve.experience_to_next_level)
              ORDER BY curve.level SEPARATOR '|')
             FROM difficulty_level_experiences curve
             WHERE curve.difficulty = users.difficulty AND curve.deleted_at IS NULL) AS experience_curve
     FROM user_stats stats
     INNER JOIN users ON users.id = stats.user_id AND users.deleted_at IS NULL
     WHERE stats.user_id = ? AND stats.deleted_at IS NULL LIMIT 1 FOR UPDATE`,
    [userId]
  );
  if (!beforeRows.length) {
    throw new Error('Statistik pengguna tidak ditemukan untuk pemberian EXP.');
  }

  const before = beforeRows[0];
  const difficulty = before.difficulty || 'easy';
  const curve = parseExperienceCurve(before.experience_curve);
  const nextExperience = Math.max(0, Number(before.experience) + safeAmount);
  const nextLevel = levelForExperience(nextExperience, difficulty, curve);
  await connection.query(
    `UPDATE user_stats SET level = ?, experience = ?, experience_to_next_level = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [nextLevel, nextExperience, experienceForLevel(nextLevel, difficulty, curve), userId]
  );
  await connection.query(
    'INSERT INTO user_experience_logs (user_id, source, amount, description) VALUES (?, ?, ?, ?)',
    [userId, source, safeAmount, description || null]
  );

  if (nextLevel > Number(before.level)) {
    await connection.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'level_up', 'Level up!', ?, JSON_OBJECT('level', ?))`,
      [userId, `Kamu mencapai level ${nextLevel}.`, nextLevel]
    );
  }
  return { amount: safeAmount, levelUp: nextLevel > Number(before.level), level: nextLevel };
}

async function getProgression(userId) {
  const [rows] = await pool.query(
    `SELECT stats.level, stats.experience, stats.experience_to_next_level,
            users.difficulty,
            (SELECT GROUP_CONCAT(CONCAT(curve.level, ':', curve.experience_to_next_level)
              ORDER BY curve.level SEPARATOR '|')
             FROM difficulty_level_experiences curve
             WHERE curve.difficulty = users.difficulty AND curve.deleted_at IS NULL) AS experience_curve,
            stats.health_points, stats.mana_points, stats.strength, stats.intelligence,
            stats.agility, stats.stamina, stats.luck,
            classes.id AS class_id, classes.name AS class_name, classes.label AS class_label,
            classes.description AS class_description, classes.primary_stat,
            classes.strength_bonus, classes.intelligence_bonus, classes.agility_bonus,
            classes.stamina_bonus, classes.luck_bonus
     FROM user_stats stats
     INNER JOIN users ON users.id = stats.user_id AND users.deleted_at IS NULL
     LEFT JOIN player_classes classes ON classes.id = users.class_id AND classes.deleted_at IS NULL
     WHERE stats.user_id = ? AND stats.deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  const [skills] = await pool.query(
    `SELECT skills.id, skills.name, skills.label, skills.description, user_skills.level, user_skills.experience,
            user_skills.experience_to_next_level
     FROM user_skills INNER JOIN skills ON skills.id = user_skills.skill_id
     WHERE user_skills.user_id = ? AND user_skills.deleted_at IS NULL AND skills.deleted_at IS NULL
     ORDER BY skills.label`,
    [userId]
  );
  const character = rows[0] || null;
  if (character) {
    const curve = parseExperienceCurve(character.experience_curve);
    character.experience_curve = curve || [];
    character.level = levelForExperience(character.experience, character.difficulty || 'easy', curve);
    character.experience_to_next_level = experienceForLevel(character.level, character.difficulty || 'easy', curve);
  }
  return { character, skills };
}

module.exports = { grantExperience, getProgression, experienceForLevel, levelForExperience };
