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
      `SELECT users.id, users.name, users.email, users.affiliate_code, users.referred_by, users.difficulty,
              users.created_at, users.updated_at,
              roles.id AS role_id, roles.name AS role_name, roles.label AS role_label,
              companies.id AS company_id, companies.name AS company_name,
              companies.legal_name AS company_legal_name, companies.code AS company_code,
              user_profiles.employee_number, user_profiles.position, user_profiles.department,
              user_profiles.phone, user_profiles.gender, user_profiles.birth_date,
              user_profiles.avatar_url, user_profiles.address, user_profiles.city,
              user_profiles.province, user_profiles.country, user_profiles.postal_code,
              user_profiles.joined_at, user_profiles.bio,
              user_stats.level, user_stats.experience, user_stats.experience_to_next_level,
              user_stats.health_points, user_stats.mana_points, user_stats.strength,
              user_stats.intelligence, user_stats.agility, user_stats.stamina, user_stats.luck
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       LEFT JOIN companies ON companies.id = users.company_id
       LEFT JOIN user_profiles ON user_profiles.user_id = users.id
       LEFT JOIN user_stats ON user_stats.user_id = users.id
       WHERE users.id = ? AND users.deleted_at IS NULL
       LIMIT 1`,
      [payload.sub]
    );

    if (!users.length) {
      return res.status(401).json({
        message: 'Token otentikasi tidak valid.',
      });
    }

    await pool.query(
      `INSERT IGNORE INTO user_skills (user_id, skill_id)
       SELECT ?, skills.id
       FROM missions
       INNER JOIN skills ON skills.name = missions.reward_key
       WHERE missions.user_id = ?
         AND missions.reward_type = 'skill'
         AND missions.completed = 1`,
      [users[0].id, users[0].id]
    );

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
      affiliate_code: users[0].affiliate_code,
      referred_by: users[0].referred_by,
      role: {
        id: users[0].role_id,
        name: users[0].role_name,
        label: users[0].role_label,
      },
      company: users[0].company_id
        ? {
            id: users[0].company_id,
            name: users[0].company_name,
            legal_name: users[0].company_legal_name,
            code: users[0].company_code,
          }
        : null,
      profile: {
        employee_number: users[0].employee_number,
        position: users[0].position,
        department: users[0].department,
        phone: users[0].phone,
        gender: users[0].gender,
        birth_date: users[0].birth_date,
        avatar_url: users[0].avatar_url,
        address: users[0].address,
        city: users[0].city,
        province: users[0].province,
        country: users[0].country,
        postal_code: users[0].postal_code,
        joined_at: users[0].joined_at,
        bio: users[0].bio,
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
      difficulty: users[0].difficulty,
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
