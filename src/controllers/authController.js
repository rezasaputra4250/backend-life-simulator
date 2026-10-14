const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const env = require('../config/env');
const { signAuthToken } = require('../utils/jwt');
const { createResetToken, hashResetToken } = require('../utils/passwordReset');

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: {
      id: user.role_id,
      name: user.role_name,
      label: user.role_label,
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
  };
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

    const { name, email, password, role } = req.body;
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
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

    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (role_id, name, email, password) VALUES (?, ?, ?, ?)',
      [roles[0].id, name, email, hashedPassword]
    );

    await pool.query('INSERT INTO user_stats (user_id) VALUES (?)', [
      result.insertId,
    ]);

    const user = {
      id: result.insertId,
      role_id: roles[0].id,
      role_name: roles[0].name,
      role_label: roles[0].label,
      name,
      email,
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
              roles.id AS role_id, roles.name AS role_name, roles.label AS role_label,
              user_stats.level, user_stats.experience, user_stats.experience_to_next_level,
              user_stats.health_points, user_stats.mana_points, user_stats.strength,
              user_stats.intelligence, user_stats.agility, user_stats.stamina, user_stats.luck
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       LEFT JOIN user_stats ON user_stats.user_id = users.id
       WHERE users.email = ?
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
      user: formatUser(user),
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
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
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
