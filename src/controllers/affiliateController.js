const pool = require('../config/database');

async function profile(req, res, next) {
  try {
    const [users] = await pool.query(
      'SELECT id, affiliate_code, referred_by FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'Data affiliate tidak ditemukan.' });
    }

    const [referrals] = await pool.query(
      `SELECT users.id, users.name, users.email, affiliate_referrals.created_at
       FROM affiliate_referrals
       INNER JOIN users ON users.id = affiliate_referrals.referred_user_id
       WHERE affiliate_referrals.affiliate_user_id = ?
       ORDER BY affiliate_referrals.created_at DESC`,
      [req.user.id]
    );

    return res.json({
      message: 'Data affiliate berhasil diambil.',
      affiliate: {
        code: users[0].affiliate_code,
        referrals_count: referrals.length,
        referrals,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { profile };
