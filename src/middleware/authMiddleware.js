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
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [payload.sub]
    );

    if (!users.length) {
      return res.status(401).json({
        message: 'Token otentikasi tidak valid.',
      });
    }

    req.user = users[0];
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
