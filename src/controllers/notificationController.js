const pool = require('../config/database');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT id, type, title, body, data, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
    res.json({ message: 'Notifikasi berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function read(req, res, next) {
  try {
    const [result] = await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
    res.json({ message: 'Notifikasi ditandai sudah dibaca.', data: { id: Number(req.params.id) } });
  } catch (error) { next(error); }
}

async function readAll(req, res, next) {
  try { await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id]); res.json({ message: 'Semua notifikasi sudah dibaca.', data: {} }); }
  catch (error) { next(error); }
}

module.exports = { list, read, readAll };
