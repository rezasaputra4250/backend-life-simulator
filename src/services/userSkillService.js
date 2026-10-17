const { skillsByClass } = require('../constants/skills');

const baseSkillNames = ['productivity', 'communication'];

async function ensureUserSkills(connection, userId, className) {
  const skillNames = [...new Set([
    ...baseSkillNames,
    ...(skillsByClass[className] || []),
  ])];
  const placeholders = skillNames.map(() => '?').join(', ');

  await connection.query(
    `INSERT IGNORE INTO user_skills (user_id, skill_id)
     SELECT ?, skills.id
     FROM skills
     WHERE skills.name IN (${placeholders})`,
    [userId, ...skillNames]
  );
  await connection.query(
    `UPDATE user_skills
     INNER JOIN skills ON skills.id = user_skills.skill_id
     SET user_skills.deleted_at = NULL, user_skills.updated_at = CURRENT_TIMESTAMP
     WHERE user_skills.user_id = ? AND skills.name IN (${placeholders})`,
    [userId, ...skillNames]
  );
}

module.exports = {
  ensureUserSkills,
};
