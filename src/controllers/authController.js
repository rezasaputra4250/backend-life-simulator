const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const env = require('../config/env');
const { signAuthToken } = require('../utils/jwt');
const { createResetToken, hashResetToken } = require('../utils/passwordReset');
const { allMissionSeeds } = require('../constants/missions');
const { generateAffiliateCode } = require('../utils/affiliate');
const { ensureSystemMission } = require('../services/missionDomainService');

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    affiliate_code: user.affiliate_code,
    referred_by: user.referred_by,
    difficulty: user.difficulty || 'easy',
    role: {
      id: user.role_id,
      name: user.role_name,
      label: user.role_label,
    },
    company: user.company_id
      ? {
          id: user.company_id,
          name: user.company_name,
          legal_name: user.company_legal_name,
          code: user.company_code,
        }
      : null,
    profile: {
      employee_number: user.employee_number,
      position: user.position,
      department: user.department,
      phone: user.phone,
      gender: user.gender,
      birth_date: user.birth_date,
      avatar_url: user.avatar_url,
      address: user.address,
      city: user.city,
      province: user.province,
      country: user.country,
      postal_code: user.postal_code,
      joined_at: user.joined_at,
      bio: user.bio,
    },
    stats: {
      level: user.level,
      experience: user.experience,
      experience_to_next_level: user.experience_to_next_level,
      health_points: user.health_points,
      mana_points: user.mana_points,
      strength: user.strength,
      intelligence: user.intelligence,
      agility: user.agility,
      stamina: user.stamina,
      luck: user.luck,
    },
    skills: user.skills || [],
  };
}

async function getUserSkills(userId) {
  const [skills] = await pool.query(
    `SELECT skills.id, skills.name, skills.label, skills.description,
            user_skills.level, user_skills.experience,
            user_skills.experience_to_next_level, user_skills.unlocked_at
     FROM user_skills
     INNER JOIN skills ON skills.id = user_skills.skill_id
     WHERE user_skills.user_id = ? AND user_skills.deleted_at IS NULL AND skills.deleted_at IS NULL
     ORDER BY skills.label ASC`,
    [userId]
  );

  return skills;
}

async function unlockDefaultSkills(userId) {
  await pool.query(
    `INSERT IGNORE INTO user_skills (user_id, skill_id)
     SELECT ?, skills.id
     FROM skills
     WHERE skills.name IN ('productivity', 'communication')`,
    [userId]
  );
}

async function createDefaultMissions(userId) {
  const [users] = await pool.query(
    'SELECT difficulty FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId]
  );
  const difficulty = users[0]?.difficulty || 'easy';

  for (const mission of allMissionSeeds) {
    await ensureSystemMission(pool, userId, difficulty, {
      ...mission,
      frequency: mission.frequency || 'daily',
      duration_minutes: mission.duration_minutes || 15,
    });
  }
}

function validationErrorResponse(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return null;
  }

  return res.status(422).json({
    message: 'Data yang diberikan tidak valid.',
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
}

async function register(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { name, email, password, role, company_id, referral_code } = req.body;
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    if (existingUsers.length) {
      return res.status(409).json({
        message: 'Email sudah terdaftar.',
      });
    }

    const [roles] = await pool.query(
      'SELECT id, name, label FROM roles WHERE name = ? LIMIT 1',
      [role || 'staff']
    );

    if (!roles.length) {
      return res.status(422).json({
        message: 'Role tidak valid.',
      });
    }

    let company = null;
    let referrer = null;

    if (company_id) {
      const [companies] = await pool.query(
        'SELECT id, name, legal_name, code FROM companies WHERE id = ? LIMIT 1',
        [company_id]
      );

      if (!companies.length) {
        return res.status(422).json({
          message: 'Perusahaan tidak ditemukan.',
        });
      }

      company = companies[0];
    }

    if (referral_code) {
      const [referrers] = await pool.query(
        'SELECT id, affiliate_code FROM users WHERE affiliate_code = ? AND deleted_at IS NULL LIMIT 1',
        [referral_code.toUpperCase()]
      );

      if (!referrers.length) {
        return res.status(422).json({ message: 'Kode referral tidak ditemukan.' });
      }

      referrer = referrers[0];
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let affiliateCode = generateAffiliateCode();
    let duplicateCodes;

    do {
      [duplicateCodes] = await pool.query(
        'SELECT id FROM users WHERE affiliate_code = ? AND deleted_at IS NULL LIMIT 1',
        [affiliateCode]
      );
      if (duplicateCodes.length) affiliateCode = generateAffiliateCode();
    } while (duplicateCodes.length);

    const [result] = await pool.query(
      `INSERT INTO users
         (role_id, company_id, name, email, password, affiliate_code, referred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roles[0].id, company ? company.id : null, name, email, hashedPassword, affiliateCode, referrer ? referrer.id : null]
    );

    if (referrer) {
      await pool.query(
        `INSERT INTO affiliate_referrals (affiliate_user_id, referred_user_id, referral_code)
         VALUES (?, ?, ?)`,
        [referrer.id, result.insertId, referrer.affiliate_code]
      );
    }

    await pool.query('INSERT INTO user_stats (user_id) VALUES (?)', [
      result.insertId,
    ]);
    await pool.query('INSERT INTO user_profiles (user_id) VALUES (?)', [
      result.insertId,
    ]);
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES (?)', [
      result.insertId,
    ]);
    await unlockDefaultSkills(result.insertId);
    await createDefaultMissions(result.insertId);

    const user = {
      id: result.insertId,
      role_id: roles[0].id,
      role_name: roles[0].name,
      role_label: roles[0].label,
      company_id: company ? company.id : null,
      company_name: company ? company.name : null,
      company_legal_name: company ? company.legal_name : null,
      company_code: company ? company.code : null,
      name,
      email,
      affiliate_code: affiliateCode,
      referred_by: referrer ? referrer.id : null,
      employee_number: null,
      position: null,
      department: null,
      phone: null,
      gender: null,
      birth_date: null,
      avatar_url: null,
      address: null,
      city: null,
      province: null,
      country: 'Indonesia',
      postal_code: null,
      joined_at: null,
      bio: null,
      level: 1,
      experience: 0,
      experience_to_next_level: 100,
      health_points: 100,
      mana_points: 50,
      strength: 5,
      intelligence: 5,
      agility: 5,
      stamina: 5,
      luck: 5,
      skills: await getUserSkills(result.insertId),
    };

    return res.status(201).json({
      message: 'Registrasi berhasil.',
      user: formatUser(user),
      token: signAuthToken(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { email, password } = req.body;
    const [users] = await pool.query(
      `SELECT users.id, users.name, users.email, users.password,
              users.affiliate_code, users.referred_by, users.difficulty,
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
       WHERE users.email = ? AND users.deleted_at IS NULL
       LIMIT 1`,
      [email]
    );

    if (!users.length) {
      return res.status(401).json({
        message: 'Email atau password salah.',
      });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Email atau password salah.',
      });
    }

    return res.json({
      message: 'Login berhasil.',
      user: formatUser({
        ...user,
        skills: await getUserSkills(user.id),
      }),
      token: signAuthToken(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res) {
  return res.json({
    message: 'Data pengguna berhasil diambil.',
    user: req.user,
  });
}

async function forgotPassword(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { email } = req.body;
    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    if (!users.length) {
      return res.json({
        message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
      });
    }

    const { token, tokenHash } = createResetToken();
    const expiresAt = new Date(
      Date.now() + env.passwordReset.expiresMinutes * 60 * 1000
    );

    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [users[0].id, tokenHash, expiresAt]
    );

    const resetUrl = `${env.passwordReset.frontendUrl}?token=${token}&email=${encodeURIComponent(email)}`;

    if (env.nodeEnv !== 'production') {
      console.log('Reset password URL:', resetUrl);
    }

    return res.json({
      message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
      resetUrl: env.nodeEnv === 'production' ? undefined : resetUrl,
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { email, token, password } = req.body;
    const tokenHash = hashResetToken(token);

    const [rows] = await pool.query(
      `SELECT password_resets.id, password_resets.user_id
       FROM password_resets
       INNER JOIN users ON users.id = password_resets.user_id
       WHERE users.email = ?
         AND password_resets.token_hash = ?
         AND password_resets.used_at IS NULL
         AND password_resets.expires_at > NOW()
       ORDER BY password_resets.created_at DESC
       LIMIT 1`,
      [email, tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({
        message: 'Token reset password tidak valid atau sudah kedaluwarsa.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      rows[0].user_id,
    ]);

    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [
      rows[0].id,
    ]);

    return res.json({
      message: 'Password berhasil direset.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
};
