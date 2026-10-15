const pool = require('../config/database');
const { validationResult } = require('express-validator');
const { missionSeeds } = require('../constants/missions');
const { itemCatalog, badgeCatalog } = require('../constants/rewards');
const { skills } = require('../constants/skills');

async function ensureDailyMissions(userId, connection = pool) {
  for (const mission of missionSeeds) {
    await connection.query(
      `INSERT INTO missions
         (user_id, mission_date, title, detail, reward, reward_type, reward_name, reward_key)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         detail = VALUES(detail), reward = VALUES(reward),
         reward_type = VALUES(reward_type), reward_name = VALUES(reward_name),
         reward_key = VALUES(reward_key)`,
      [
        userId,
        mission.title,
        mission.detail,
        mission.reward,
        mission.reward_type,
        mission.reward_name,
        mission.reward_key,
      ]
    );
  }
}

function getRewardDetails(mission) {
  const catalog = mission.reward_type === 'item'
    ? itemCatalog[mission.reward_key]
    : mission.reward_type === 'badge'
      ? badgeCatalog[mission.reward_key]
      : null;
  const skill = mission.reward_type === 'skill'
    ? skills.find((entry) => entry.name === mission.reward_key)
    : null;

  return {
    type: mission.reward_type,
    key: mission.reward_key,
    name: catalog?.name || skill?.label || mission.reward_name || `${mission.reward} XP`,
    description: catalog?.description || skill?.description || null,
    icon_key: catalog?.icon_key || mission.reward_type,
    amount: mission.reward_type === 'xp' ? mission.reward : 1,
  };
}

function formatMission(mission) {
  return {
    ...mission,
    completed: Boolean(mission.completed),
    reward: getRewardDetails(mission),
  };
}

async function list(req, res, next) {
  try {
    await ensureDailyMissions(req.user.id);
    const [missions] = await pool.query(
      `SELECT id, mission_date, title, detail, reward, reward_type, reward_name, reward_key,
              completed, completed_at, created_at, updated_at
       FROM missions
       WHERE user_id = ? AND mission_date = CURDATE()
       ORDER BY completed ASC, id ASC`,
      [req.user.id]
    );

    return res.json({
      message: 'Data misi berhasil diambil.',
      missions: missions.map(formatMission),
    });
  } catch (error) {
    return next(error);
  }
}

async function toggle(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Data yang diberikan tidak valid.',
        errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
      });
    }

    let rewardGranted = false;
    let grantedReward = null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [currentMissions] = await connection.query(
        `SELECT id, mission_date, title, detail, reward, reward_type, reward_name, reward_key, completed
         FROM missions
         WHERE id = ? AND user_id = ? AND mission_date = CURDATE()
         LIMIT 1 FOR UPDATE`,
        [req.params.id, req.user.id]
      );

      if (!currentMissions.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Misi tidak ditemukan.' });
      }

      const currentMission = currentMissions[0];
      const isCompleting = !Boolean(currentMission.completed);

      await connection.query(
        `UPDATE missions SET completed = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
        [isCompleting ? 1 : 0, isCompleting ? new Date() : null, req.params.id, req.user.id]
      );

      if (isCompleting) {
        const [rewardResult] = await connection.query(
          `INSERT IGNORE INTO user_rewards
             (user_id, mission_id, reward_type, reward_name, amount)
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.user.id,
            currentMission.id,
            currentMission.reward_type,
            currentMission.reward_name || `${currentMission.reward} XP`,
            currentMission.reward_type === 'xp' ? currentMission.reward : 1,
          ]
        );

        if (rewardResult.affectedRows && currentMission.reward_type === 'xp') {
          await connection.query(
            `UPDATE user_stats
             SET level = GREATEST(level, FLOOR((experience + ?) / 100) + 1),
                 experience_to_next_level = (FLOOR((experience + ?) / 100) + 1) * 100,
                 experience = experience + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [currentMission.reward, currentMission.reward, currentMission.reward, req.user.id]
          );
          await connection.query(
            `INSERT INTO user_experience_logs (user_id, source, amount, description)
             VALUES (?, 'mission', ?, ?)`,
            [req.user.id, currentMission.reward, currentMission.title]
          );
        }

        rewardGranted = Boolean(rewardResult.affectedRows);
        if (rewardGranted) grantedReward = getRewardDetails(currentMission);

        if (currentMission.reward_type === 'skill') {
          await connection.query(
            `INSERT IGNORE INTO user_skills (user_id, skill_id)
             SELECT ?, id FROM skills WHERE name = ? LIMIT 1`,
            [req.user.id, currentMission.reward_key || currentMission.reward_name]
          );
        }

        if (rewardResult.affectedRows && currentMission.reward_type === 'item') {
          const item = itemCatalog[currentMission.reward_key] || {
            name: currentMission.reward_name,
            description: 'Item hadiah dari quest guild.',
            icon_key: 'item',
          };
          await connection.query(
            `INSERT INTO user_inventory
               (user_id, item_key, name, description, icon_key, quantity)
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [req.user.id, currentMission.reward_key, item.name, item.description, item.icon_key]
          );
        }

        if (rewardResult.affectedRows && currentMission.reward_type === 'badge') {
          const badge = badgeCatalog[currentMission.reward_key] || {
            name: currentMission.reward_name,
            description: 'Badge pencapaian dari quest guild.',
          };
          await connection.query(
            `INSERT IGNORE INTO user_badges
               (user_id, badge_key, name, description)
             VALUES (?, ?, ?, ?)`,
            [req.user.id, currentMission.reward_key, badge.name, badge.description]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [missions] = await pool.query(
      `SELECT id, mission_date, title, detail, reward, reward_type, reward_name, reward_key,
              completed, completed_at, created_at, updated_at
       FROM missions
       WHERE id = ? AND user_id = ? AND mission_date = CURDATE()
       LIMIT 1`,
      [req.params.id, req.user.id]
    );
    const [stats] = await pool.query(
      `SELECT level, experience, experience_to_next_level, health_points, mana_points,
              strength, intelligence, agility, stamina, luck
       FROM user_stats WHERE user_id = ? LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      message: 'Status misi berhasil diperbarui.',
      mission: formatMission(missions[0]),
      reward_granted: rewardGranted,
      granted_reward: grantedReward,
      stats: stats[0] || null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, toggle };
