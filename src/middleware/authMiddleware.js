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
              roles.id AS role_id, roles.name AS role_name, roles.label AS role_label
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       WHERE users.id = ?
       LIMIT 1`,
      [payload.sub]
    );

    if (!users.length) {
      return res.status(401).json({
        message: 'Token otentikasi tidak valid.',
      });
    }

    req.user = {
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      role: {
        id: users[0].role_id,
        name: users[0].role_name,
        label: users[0].role_label,
      },
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
