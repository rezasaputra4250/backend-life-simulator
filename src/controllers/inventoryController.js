const pool = require('../config/database');

async function list(req, res, next) {
  try {
    const [items] = await pool.query(
      `SELECT item_key, name, description, icon_key, quantity, updated_at
       FROM user_inventory
       WHERE user_id = ? AND quantity > 0
       ORDER BY updated_at DESC, name ASC`,
      [req.user.id]
    );
    const [badges] = await pool.query(
      `SELECT badge_key, name, description, unlocked_at
       FROM user_badges
       WHERE user_id = ?
       ORDER BY unlocked_at DESC, name ASC`,
      [req.user.id]
    );

    return res.json({
      message: 'Inventori berhasil diambil.',
      items,
      badges,
      totals: {
        items: items.reduce((total, item) => total + item.quantity, 0),
        badges: badges.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list };
