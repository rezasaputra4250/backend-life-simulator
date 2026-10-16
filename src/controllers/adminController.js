const { validationResult } = require('express-validator');
const pool = require('../config/database');

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(422).json({ message: 'Data yang diberikan tidak valid.', errors: errors.array().map((error) => ({ field: error.path, message: error.msg })) });
  return true;
}

async function createTemplate(req, res, next) {
  try {
    if (validate(req, res)) return;
    const { title, detail, category = 'system', difficulty = 'easy', duration_minutes = 15, reward_xp = 25, reward_type = 'xp', reward_key } = req.body;
    const [result] = await pool.query(`INSERT INTO mission_templates (title, detail, category, difficulty, duration_minutes, reward_xp, reward_type, reward_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [title, detail || null, category, difficulty, duration_minutes, reward_xp, reward_type, reward_key || null]);
    const [rows] = await pool.query('SELECT * FROM mission_templates WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Template misi berhasil dibuat.', data: rows[0] });
  } catch (error) { next(error); }
}

async function toggleTemplate(req, res, next) {
  try {
    const [result] = await pool.query('UPDATE mission_templates SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Template misi tidak ditemukan.' });
    const [rows] = await pool.query('SELECT * FROM mission_templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Status template misi berhasil diubah.', data: rows[0] });
  } catch (error) { next(error); }
}

async function classes(req, res, next) {
  try { const [rows] = await pool.query('SELECT * FROM player_classes ORDER BY id'); res.json({ message: 'Data class berhasil diambil.', data: rows }); }
  catch (error) { next(error); }
}

module.exports = { createTemplate, toggleTemplate, classes };
