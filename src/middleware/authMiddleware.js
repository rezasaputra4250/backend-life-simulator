const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        message: 'Token otentikasi tidak ditemukan.',
      });
    }

    const payload = jwt.verify(token, env.jwt.secret);
    const [users] = await pool.query(
      `SELECT users.id, users.name, users.email, users.created_at, users.updated_at,
              roles.id AS role_id, roles.name AS role_name, roles.label AS role_label,
              user_stats.level, user_stats.experience, user_stats.experience_to_next_level,
              user_stats.health_points, user_stats.mana_points, user_stats.strength,
              user_stats.intelligence, user_stats.agility, user_stats.stamina, user_stats.luck
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       LEFT JOIN user_stats ON user_stats.user_id = users.id
       WHERE users.id = ?
       LIMIT 1`,
      [payload.sub]
    );

    if (!users.length) {
      return res.status(401).json({
        message: 'Token otentikasi tidak valid.',
      });
    }

    const [skills] = await pool.query(
      `SELECT skills.id, skills.name, skills.label, skills.description,
              user_skills.level, user_skills.experience,
              user_skills.experience_to_next_level, user_skills.unlocked_at
       FROM user_skills
       INNER JOIN skills ON skills.id = user_skills.skill_id
       WHERE user_skills.user_id = ?
       ORDER BY skills.label ASC`,
      [users[0].id]
    );

    req.user = {
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      role: {
        id: users[0].role_id,
        name: users[0].role_name,
        label: users[0].role_label,
      },
      stats: {
        level: users[0].level,
        experience: users[0].experience,
        experience_to_next_level: users[0].experience_to_next_level,
        health_points: users[0].health_points,
        mana_points: users[0].mana_points,
        strength: users[0].strength,
        intelligence: users[0].intelligence,
        agility: users[0].agility,
        stamina: users[0].stamina,
        luck: users[0].luck,
      },
      skills,
      created_at: users[0].created_at,
      updated_at: users[0].updated_at,
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token otentikasi tidak valid atau sudah kedaluwarsa.',
    });
  }
}

module.exports = {
  authenticate,
};
