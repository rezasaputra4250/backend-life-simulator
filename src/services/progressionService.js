const pool = require('../config/database');

function experienceForLevel(level) {
  return Math.max(100, Number(level) * 100);
}

async function grantExperience(connection, userId, amount, source, description) {
  const safeAmount = Math.max(0, Math.min(Number(amount) || 0, 1000));
  if (!safeAmount) return { amount: 0, levelUp: false };

  const [beforeRows] = await connection.query(
    'SELECT level, experience FROM user_stats WHERE user_id = ? LIMIT 1 FOR UPDATE',
    [userId]
  );
  if (!beforeRows.length) return { amount: 0, levelUp: false };

  const before = beforeRows[0];
  const nextExperience = Number(before.experience) + safeAmount;
  const nextLevel = Math.floor(nextExperience / 100) + 1;
  await connection.query(
    `UPDATE user_stats SET level = ?, experience = ?, experience_to_next_level = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [nextLevel, nextExperience, experienceForLevel(nextLevel), userId]
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
            classes.id AS class_id, classes.name AS class_name, classes.label AS class_label,
            classes.description AS class_description, classes.primary_stat,
            classes.strength_bonus, classes.intelligence_bonus, classes.agility_bonus,
            classes.stamina_bonus, classes.luck_bonus
     FROM user_stats stats
     LEFT JOIN user_classes ON user_classes.user_id = stats.user_id
     LEFT JOIN player_classes classes ON classes.id = user_classes.class_id
     WHERE stats.user_id = ? LIMIT 1`,
    [userId]
  );
  const [skills] = await pool.query(
    `SELECT skills.name, skills.label, skills.description, user_skills.level, user_skills.experience,
            user_skills.experience_to_next_level
     FROM user_skills INNER JOIN skills ON skills.id = user_skills.skill_id
     WHERE user_skills.user_id = ? ORDER BY skills.label`,
    [userId]
  );
  return { character: rows[0] || null, skills };
}

module.exports = { grantExperience, getProgression, experienceForLevel };
