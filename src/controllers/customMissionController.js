const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { grantExperience } = require('../services/progressionService');

const allowedDifficulties = ['easy', 'normal', 'hard', 'expert'];
function invalid(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(422).json({ message: 'Data yang diberikan tidak valid.', errors: errors.array().map((error) => ({ field: error.path, message: error.msg })) });
  return true;
}

async function templates(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT id, title, detail, category, difficulty, duration_minutes, reward_xp, reward_type, reward_key
      FROM mission_templates WHERE is_active = 1 ORDER BY id DESC`);
    res.json({ message: 'Template misi berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    if (invalid(req, res)) return;
    const { title, detail, category = 'personal', duration_minutes = 15, mission_date, frequency = 'daily', scheduled_time } = req.body;
    const [userRows] = await pool.query('SELECT difficulty FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
    const difficulty = allowedDifficulties.includes(userRows[0]?.difficulty) ? userRows[0].difficulty : 'easy';
    const [difficultyRows] = await pool.query(
      'SELECT base_reward_xp FROM difficulty_configs WHERE difficulty = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
      [difficulty]
    );
    const reward = Number(difficultyRows[0]?.base_reward_xp || 25);
    const date = mission_date ? String(mission_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO missions (user_id, category, mission_date, frequency, scheduled_time, title, detail, difficulty,
         duration_minutes, reward, reward_type, reward_name, reward_key, custom_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'xp', ?, 'xp', 1)`,
      [req.user.id, category, date, frequency, scheduled_time || null, title, detail || null, difficulty, duration_minutes, reward, `${reward} XP`]
    );
    const [rows] = await pool.query('SELECT id, category, mission_date, frequency, scheduled_time, title, detail, difficulty, duration_minutes, reward, reward_type, reward_name, reward_key, completed, failed FROM missions WHERE id = ? AND deleted_at IS NULL', [result.insertId]);
    res.status(201).json({ message: 'Misi berhasil dibuat.', data: rows[0] });
  } catch (error) { next(error); }
}

async function complete(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [missions] = await connection.query("SELECT * FROM missions WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND category = 'personal' LIMIT 1 FOR UPDATE", [req.params.id, req.user.id]);
    if (!missions.length) { await connection.rollback(); return res.status(404).json({ message: 'Misi tidak ditemukan.' }); }
    const mission = missions[0];
    if (mission.completed) { await connection.rollback(); return res.status(409).json({ message: 'Misi sudah selesai.' }); }
    if (mission.failed) { await connection.rollback(); return res.status(409).json({ message: 'Misi sudah gagal.' }); }
    const [reward] = await connection.query(
      `INSERT INTO user_rewards (user_id, mission_id, reward_type, reward_name, amount)
       VALUES (?, ?, 'xp', ?, ?)
       ON DUPLICATE KEY UPDATE deleted_at = NULL, amount = VALUES(amount)`,
      [req.user.id, mission.id, mission.reward_name || `${mission.reward} XP`, mission.reward]
    );
    if (reward.affectedRows) {
      await connection.query(
        `INSERT IGNORE INTO reward_transactions (user_id, source_type, source_id, reward_type, amount)
         VALUES (?, 'mission', ?, 'xp', ?)`,
        [req.user.id, mission.id, mission.reward]
      );
    }
    await connection.query('UPDATE missions SET completed = 1, completed_at = NOW() WHERE id = ?', [mission.id]);
    const progression = reward.affectedRows
      ? await grantExperience(connection, req.user.id, mission.reward, 'mission', mission.title, {
        sourceId: mission.id,
        idempotencyKey: `mission:${mission.id}:xp`,
      })
      : { amount: 0, levelUp: false };
    await connection.query('INSERT INTO notifications (user_id, type, title, body) VALUES (?, \'reward\', \'Misi selesai\', ?)', [req.user.id, `Kamu mendapatkan ${mission.reward} XP dari misi: ${mission.title}.`]);
    await connection.commit();
    res.json({ message: 'Misi berhasil diselesaikan.', data: { mission_id: mission.id, reward_granted: Boolean(reward.affectedRows), xp: progression.amount, level_up: progression.levelUp } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
}

module.exports = { templates, create, complete };
