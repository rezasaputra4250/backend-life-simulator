const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { getProgression } = require('../services/progressionService');

function invalid(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(422).json({
    message: 'Data yang diberikan tidak valid.',
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
  return true;
}

async function classes(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, label, description, primary_stat, strength_bonus, intelligence_bonus,
              agility_bonus, stamina_bonus, luck_bonus
       FROM player_classes WHERE is_active = 1 ORDER BY id`
    );
    res.json({ message: 'Daftar class berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function selectClass(req, res, next) {
  try {
    if (invalid(req, res)) return;
    const [classes] = await pool.query('SELECT * FROM player_classes WHERE id = ? AND is_active = 1 LIMIT 1', [req.body.class_id]);
    if (!classes.length) return res.status(404).json({ message: 'Class tidak ditemukan.' });
    const chosen = classes[0];
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query('SELECT user_id FROM user_classes WHERE user_id = ? LIMIT 1 FOR UPDATE', [req.user.id]);
      if (existing.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Class karakter sudah dipilih.' });
      }
      await connection.query('INSERT INTO user_classes (user_id, class_id) VALUES (?, ?)', [req.user.id, chosen.id]);
      await connection.query(
        `UPDATE user_stats SET strength = strength + ?, intelligence = intelligence + ?, agility = agility + ?,
         stamina = stamina + ?, luck = luck + ? WHERE user_id = ?`,
        [chosen.strength_bonus, chosen.intelligence_bonus, chosen.agility_bonus, chosen.stamina_bonus, chosen.luck_bonus, req.user.id]
      );
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    res.status(201).json({ message: 'Class karakter berhasil dipilih.', data: chosen });
  } catch (error) { next(error); }
}

async function progression(req, res, next) {
  try { res.json({ message: 'Progression berhasil diambil.', data: await getProgression(req.user.id) }); }
  catch (error) { next(error); }
}

async function leaderboard(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT users.id, users.name, stats.level, stats.experience,
              COALESCE(classes.label, 'Belum memilih class') AS class_label
       FROM users INNER JOIN user_stats stats ON stats.user_id = users.id
       LEFT JOIN user_classes user_classes ON user_classes.user_id = users.id
       LEFT JOIN player_classes classes ON classes.id = user_classes.class_id
       ORDER BY stats.experience DESC, stats.level DESC, users.id ASC LIMIT 50`
    );
    res.json({ message: 'Leaderboard berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

module.exports = { classes, selectClass, progression, leaderboard };
