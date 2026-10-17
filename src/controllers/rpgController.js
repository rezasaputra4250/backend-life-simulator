const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { allMissionSeeds } = require('../constants/missions');
const { getProgression, experienceForLevel, levelForExperience } = require('../services/progressionService');
const { ensureUserSkills } = require('../services/userSkillService');
const { ensureSystemMission } = require('../services/missionDomainService');

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
       FROM player_classes WHERE is_active = 1 AND deleted_at IS NULL ORDER BY id`
    );
    res.json({ message: 'Daftar class berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function selectClass(req, res, next) {
  try {
    if (invalid(req, res)) return;
    const [classes] = await pool.query('SELECT * FROM player_classes WHERE id = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1', [req.body.class_id]);
    if (!classes.length) return res.status(404).json({ message: 'Class tidak ditemukan.' });
    const chosen = classes[0];
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.query(
        'SELECT class_id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [req.user.id]
      );
      if (!users.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
      }
      const [existing] = await connection.query(
        'SELECT user_id, class_id, deleted_at FROM user_classes WHERE user_id = ? LIMIT 1 FOR UPDATE',
        [req.user.id]
      );
      const previousClassId = users[0].class_id || existing[0]?.class_id || null;
      if (previousClassId && Number(previousClassId) === Number(chosen.id)) {
        await connection.rollback();
        return res.status(200).json({ message: 'Class karakter sudah dipilih sebelumnya.', data: chosen });
      }

      let previousClass = null;
      if (previousClassId) {
        const [previousClasses] = await connection.query(
          `SELECT strength_bonus, intelligence_bonus, agility_bonus, stamina_bonus, luck_bonus
           FROM player_classes WHERE id = ? LIMIT 1`,
          [previousClassId]
        );
        previousClass = previousClasses[0] || null;
      }
      if (existing.length) {
        await connection.query(
          `UPDATE user_classes
           SET class_id = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [chosen.id, req.user.id]
        );
      } else {
        await connection.query('INSERT INTO user_classes (user_id, class_id) VALUES (?, ?)', [req.user.id, chosen.id]);
      }
      await connection.query(
        'UPDATE users SET class_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [chosen.id, req.user.id]
      );
      await connection.query(
        `UPDATE user_stats SET strength = GREATEST(0, strength + ?), intelligence = GREATEST(0, intelligence + ?),
         agility = GREATEST(0, agility + ?), stamina = GREATEST(0, stamina + ?), luck = GREATEST(0, luck + ?)
         WHERE user_id = ?`,
        [
          Number(chosen.strength_bonus) - Number(previousClass?.strength_bonus || 0),
          Number(chosen.intelligence_bonus) - Number(previousClass?.intelligence_bonus || 0),
          Number(chosen.agility_bonus) - Number(previousClass?.agility_bonus || 0),
          Number(chosen.stamina_bonus) - Number(previousClass?.stamina_bonus || 0),
          Number(chosen.luck_bonus) - Number(previousClass?.luck_bonus || 0),
          req.user.id,
        ]
      );
      await ensureUserSkills(connection, req.user.id, chosen.name);
      const [userDifficulty] = await connection.query(
        'SELECT difficulty FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      );
      for (const mission of allMissionSeeds) {
        if (mission.required_class && mission.required_class !== chosen.name) continue;
        await ensureSystemMission(connection, req.user.id, userDifficulty[0]?.difficulty || 'easy', mission);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    res.status(200).json({ message: 'Class karakter berhasil diperbarui.', data: chosen });
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
       LEFT JOIN player_classes classes ON classes.id = users.class_id
       WHERE users.deleted_at IS NULL
       ORDER BY stats.experience DESC, stats.level DESC, users.id ASC LIMIT 50`
    );
    res.json({ message: 'Leaderboard berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function difficultyConfigs(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT difficulty, base_reward_xp, description
       FROM difficulty_configs
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY FIELD(difficulty, 'easy', 'normal', 'hard', 'expert')`
    );
    res.json({ message: 'Konfigurasi difficulty berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

async function updateDifficulty(req, res, next) {
  try {
    if (invalid(req, res)) return;
    const [users] = await pool.query(
      'SELECT difficulty FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [req.user.id]
    );
    if (!users.length) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    if (users[0].difficulty === req.body.difficulty) {
      return res.json({ message: 'Difficulty sudah digunakan.', data: { difficulty: req.body.difficulty } });
    }
    const [result] = await pool.query(
      'UPDATE users SET difficulty = ? WHERE id = ? AND deleted_at IS NULL',
      [req.body.difficulty, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    const [stats] = await pool.query(
      'SELECT experience FROM user_stats WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      [req.user.id]
    );
    if (stats.length) {
      const [curveRows] = await pool.query(
        `SELECT level, experience_to_next_level
         FROM difficulty_level_experiences
         WHERE difficulty = ? AND deleted_at IS NULL
         ORDER BY level ASC`,
        [req.body.difficulty]
      );
      const curve = curveRows.map((row) => ({
        level: Number(row.level),
        experience_to_next_level: Number(row.experience_to_next_level),
      }));
      const level = levelForExperience(stats[0].experience, req.body.difficulty, curve);
      await pool.query(
        `UPDATE user_stats
         SET level = ?, experience_to_next_level = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND deleted_at IS NULL`,
        [level, experienceForLevel(level, req.body.difficulty, curve), req.user.id]
      );
    }
    res.json({ message: 'Difficulty berhasil diperbarui. Misi lama tidak berubah.', data: { difficulty: req.body.difficulty } });
  } catch (error) { next(error); }
}

async function experienceHistory(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, source_type, source_id, amount, reason, created_at
       FROM experience_transactions
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ message: 'Riwayat EXP berhasil diambil.', data: rows });
  } catch (error) { next(error); }
}

module.exports = { classes, selectClass, progression, leaderboard, difficultyConfigs, updateDifficulty, experienceHistory };
