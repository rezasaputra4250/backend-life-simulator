const pool = require('../config/database');
const { validationResult } = require('express-validator');
const { allMissionSeeds } = require('../constants/missions');
const { itemCatalog, badgeCatalog } = require('../constants/rewards');
const { skills } = require('../constants/skills');
const { recordMissionReward, reverseMissionExperience } = require('../services/rewardService');
const { ensureSystemMission, syncMissionStatus } = require('../services/missionDomainService');

async function ensureCurrentMissions(userId, connection = pool) {
  const [userRows] = await connection.query('SELECT difficulty FROM users WHERE id = ? LIMIT 1', [userId]);
  const difficulty = userRows[0]?.difficulty || 'easy';
  for (const mission of allMissionSeeds) {
    await ensureSystemMission(connection, userId, difficulty, mission);
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
    source: mission.category,
    ...(mission.category === 'guild' ? {
      guild_mission_id: Number(mission.id),
      guild_progress: {
        current: Number(mission.current_progress || 0),
        target: Number(mission.target_progress || 1),
      },
    } : {}),
    completed: Boolean(mission.completed),
    failed: Boolean(mission.failed),
    reward: getRewardDetails(mission),
  };
}

function formatTodoMission(todo) {
  const dueDate = todo.due_date ? String(todo.due_date).replace('T', ' ') : null;
  return {
    id: -Number(todo.todo_id),
    todo_id: Number(todo.todo_id),
    mission_date: dueDate ? dueDate.slice(0, 10) : null,
    frequency: 'daily',
    scheduled_time: dueDate ? dueDate.slice(11, 19) : null,
    category: 'personal',
    title: todo.title,
    detail: todo.description,
    reward: { type: 'xp', key: 'xp', name: 'To-do pribadi', description: null, icon_key: 'xp', amount: 0 },
    completed: todo.status === 'completed',
    failed: false,
    completed_at: todo.completed_at,
    failed_at: null,
  };
}

function formatGuildMission(mission) {
  return {
    id: -1000000000 - Number(mission.id),
    guild_mission_id: Number(mission.id),
    guild_id: Number(mission.guild_id),
    category: 'guild',
    mission_date: mission.mission_date,
    frequency: 'daily',
    scheduled_time: null,
    title: mission.title,
    detail: mission.detail || `Progress guild: ${mission.current_progress}/${mission.target_progress}`,
    reward: {
      type: 'xp',
      key: 'xp',
      name: `${mission.reward_xp} XP untuk kontribusi`,
      description: `Target progress ${mission.target_progress}.`,
      icon_key: 'xp',
      amount: Number(mission.reward_xp),
    },
    completed: mission.status === 'completed',
    failed: false,
    completed_at: mission.completed_at,
    failed_at: null,
    guild_progress: {
      current: Number(mission.current_progress),
      target: Number(mission.target_progress),
    },
  };
}

function getPreviousDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function getDailyStreak(userId) {
  const [days] = await pool.query(
    `SELECT DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date,
            DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
            COUNT(*) AS total_missions,
            SUM(completed = 1) AS completed_missions,
            SUM(failed = 1) AS failed_missions
     FROM missions
     WHERE user_id = ? AND deleted_at IS NULL AND category <> 'guild' AND frequency = 'daily' AND mission_date <= CURDATE()
     GROUP BY mission_date
     ORDER BY mission_date DESC`,
    [userId]
  );

  if (!days.length) return 0;

  const today = days[0].today;
  const firstDay = days.find((day) => day.mission_date === today);
  if (!firstDay || Number(firstDay.completed_missions) !== Number(firstDay.total_missions)) return 0;

  let streak = 0;
  let expectedDate = today;
  for (const day of days) {
    if (day.mission_date !== expectedDate) break;
    if (Number(day.completed_missions) !== Number(day.total_missions) || Number(day.failed_missions) > 0) break;
    streak += 1;
    expectedDate = getPreviousDate(expectedDate);
  }
  return streak;
}

async function markExpiredMissions(userId, connection = pool) {
  await connection.query(
    `UPDATE missions
     SET failed = 1, failed_at = NOW()
     WHERE user_id = ?
       AND frequency = 'daily'
       AND category <> 'guild'
       AND mission_date = CURDATE()
       AND completed = 0
       AND failed = 0
       AND scheduled_time IS NOT NULL
       AND deleted_at IS NULL
       AND scheduled_time < CURTIME()`,
    [userId]
  );
  await connection.query(
    `UPDATE system_mission_instances
     SET failed = 1, failed_at = NOW(), updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND mission_date = CURDATE() AND completed = 0 AND failed = 0
       AND scheduled_time IS NOT NULL AND scheduled_time < CURTIME() AND deleted_at IS NULL`,
    [userId]
  );
  await connection.query(
    `UPDATE personal_missions
     SET failed = 1, failed_at = NOW(), updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND mission_date = CURDATE() AND completed = 0 AND failed = 0
       AND scheduled_time IS NOT NULL AND scheduled_time < CURTIME() AND deleted_at IS NULL`,
    [userId]
  );
}

async function list(req, res, next) {
  try {
    await ensureCurrentMissions(req.user.id);
    await markExpiredMissions(req.user.id);
    const [missions] = await pool.query(
      `SELECT * FROM ((SELECT legacy_mission_id AS id, 'system' AS category, NULL AS guild_id,
              1 AS target_progress, 0 AS current_progress,
              IF(completed = 1, 'completed', 'active') AS status, difficulty,
              DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date,
              frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key,
              completed, completed_at, failed, failed_at, created_at, updated_at
       FROM system_mission_instances
       WHERE user_id = ? AND deleted_at IS NULL
         AND ((frequency = 'daily' AND mission_date = CURDATE())
           OR (frequency = 'weekly' AND mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
           OR (frequency = 'monthly' AND mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
      )
      UNION ALL
      (SELECT legacy_mission_id AS id, 'personal' AS category, NULL AS guild_id,
              1 AS target_progress, 0 AS current_progress,
              IF(completed = 1, 'completed', 'active') AS status, difficulty,
              DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date,
              frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key,
              completed, completed_at, failed, failed_at, created_at, updated_at
       FROM personal_missions
       WHERE user_id = ? AND deleted_at IS NULL
         AND ((frequency = 'daily' AND mission_date = CURDATE())
           OR (frequency = 'weekly' AND mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
           OR (frequency = 'monthly' AND mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
      )
      UNION ALL
      (SELECT legacy_mission_id AS id, 'guild' AS category, guild_id,
              target_progress, current_progress, status, difficulty,
              DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date,
              'daily' AS frequency, scheduled_time, title, detail, reward_xp AS reward,
              reward_type, reward_name, reward_key, IF(status = 'completed', 1, 0) AS completed,
              completed_at, 0 AS failed, NULL AS failed_at, created_at, updated_at
       FROM guild_missions
       INNER JOIN guild_members ON guild_members.guild_id = guild_missions.guild_id
         AND guild_members.user_id = ? AND guild_members.deleted_at IS NULL
       WHERE guild_missions.status = 'active' AND guild_missions.deleted_at IS NULL
         AND mission_date = CURDATE()
      )
      UNION ALL
      (SELECT missions.id, missions.category, missions.guild_id, missions.target_progress,
              missions.current_progress, missions.status, missions.difficulty,
              DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.frequency, missions.scheduled_time, missions.title, missions.detail,
              missions.reward, missions.reward_type, missions.reward_name, missions.reward_key,
              missions.completed, missions.completed_at, missions.failed, missions.failed_at,
              missions.created_at, missions.updated_at
       FROM missions
       WHERE missions.user_id = ? AND missions.category = 'system' AND missions.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM system_mission_instances WHERE legacy_mission_id = missions.id)
         AND ((missions.frequency = 'daily' AND missions.mission_date = CURDATE())
           OR (missions.frequency = 'weekly' AND missions.mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
           OR (missions.frequency = 'monthly' AND missions.mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
      )
      UNION ALL
      (SELECT missions.id, missions.category, missions.guild_id, missions.target_progress,
              missions.current_progress, missions.status, missions.difficulty,
              DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.frequency, missions.scheduled_time, missions.title, missions.detail,
              missions.reward, missions.reward_type, missions.reward_name, missions.reward_key,
              missions.completed, missions.completed_at, missions.failed, missions.failed_at,
              missions.created_at, missions.updated_at
       FROM missions
       WHERE missions.user_id = ? AND missions.category = 'personal' AND missions.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM personal_missions WHERE legacy_mission_id = missions.id)
         AND ((missions.frequency = 'daily' AND missions.mission_date = CURDATE())
           OR (missions.frequency = 'weekly' AND missions.mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
           OR (missions.frequency = 'monthly' AND missions.mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
      )
      UNION ALL
      (SELECT missions.id, missions.category, missions.guild_id, missions.target_progress,
              missions.current_progress, missions.status, missions.difficulty,
              DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.frequency, missions.scheduled_time, missions.title, missions.detail,
              missions.reward, missions.reward_type, missions.reward_name, missions.reward_key,
              missions.completed, missions.completed_at, missions.failed, missions.failed_at,
              missions.created_at, missions.updated_at
       FROM missions
       INNER JOIN guild_members ON guild_members.guild_id = missions.guild_id
         AND guild_members.user_id = ? AND guild_members.deleted_at IS NULL
       WHERE missions.category = 'guild' AND missions.status = 'active' AND missions.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM guild_missions WHERE legacy_mission_id = missions.id)
         AND missions.mission_date = CURDATE()
      )
      )) AS active_missions
      ORDER BY active_missions.scheduled_time IS NULL ASC, active_missions.scheduled_time ASC, active_missions.id ASC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );
    const [todoItems] = await pool.query(
      `SELECT todo_items.id AS todo_id, todo_items.title, todo_items.description,
              todo_items.status, DATE_FORMAT(todo_items.due_date, '%Y-%m-%d %H:%i:%s') AS due_date,
              todo_items.completed_at
       FROM todo_items
       INNER JOIN todo_lists ON todo_lists.id = todo_items.todo_list_id
       WHERE todo_lists.user_id = ? AND todo_lists.deleted_at IS NULL
         AND todo_items.deleted_at IS NULL AND todo_items.status <> 'cancelled'
       ORDER BY todo_items.due_date IS NULL ASC, todo_items.due_date ASC, todo_items.id ASC`,
      [req.user.id]
    );
    const streakDays = await getDailyStreak(req.user.id);
    const todoMissions = todoItems.map(formatTodoMission);
    const combinedMissions = missions.map(formatMission).concat(todoMissions).sort((left, right) => {
      if (!left.scheduled_time && !right.scheduled_time) return Number(left.id) - Number(right.id);
      if (!left.scheduled_time) return 1;
      if (!right.scheduled_time) return -1;
      return String(left.scheduled_time).localeCompare(String(right.scheduled_time));
    });

    return res.json({
      message: 'Data misi berhasil diambil.',
      missions: combinedMissions,
      stats: { streak_days: streakDays },
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
      await markExpiredMissions(req.user.id, connection);

      const [currentMissions] = await connection.query(
        `SELECT id, category, DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date, frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key,
                completed, failed, difficulty
         FROM missions
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND category <> 'guild'
           AND ((frequency = 'daily' AND mission_date = CURDATE())
             OR (frequency = 'weekly' AND mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
             OR (frequency = 'monthly' AND mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
         LIMIT 1 FOR UPDATE`,
        [req.params.id, req.user.id]
      );

      if (!currentMissions.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Misi tidak ditemukan.' });
      }

      const currentMission = currentMissions[0];
      if (currentMission.failed) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Misi sudah gagal karena waktu pelaksanaannya terlewat.',
        });
      }
      const isCompleting = !Boolean(currentMission.completed);

      if (!isCompleting) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Misi sudah selesai. Gunakan pembatalan jika misi tidak sengaja diklik.',
        });
      }

      await connection.query(
        `UPDATE missions SET completed = ?, completed_at = ? WHERE id = ? AND user_id = ? AND category <> 'guild'`,
        [isCompleting ? 1 : 0, isCompleting ? new Date() : null, req.params.id, req.user.id]
      );
      await syncMissionStatus(connection, {
        ...currentMission,
        completed: isCompleting,
        completed_at: isCompleting ? new Date() : null,
        failed: Boolean(currentMission.failed),
        failed_at: null,
      });

      if (isCompleting) {
        const reward = await recordMissionReward(connection, req.user.id, currentMission);
        rewardGranted = reward.granted;
        if (rewardGranted) grantedReward = getRewardDetails(currentMission);

        if (rewardGranted && currentMission.reward_type === 'skill') {
          await connection.query(
            `INSERT IGNORE INTO user_skills (user_id, skill_id)
             SELECT ?, id FROM skills WHERE name = ? LIMIT 1`,
            [req.user.id, currentMission.reward_key || currentMission.reward_name]
          );

          const skillExperience = Math.max(currentMission.reward || 0, 10);
          await connection.query(
            `UPDATE user_skills
             INNER JOIN skills ON skills.id = user_skills.skill_id
             SET user_skills.level = GREATEST(
                   user_skills.level,
                   FLOOR((user_skills.experience + ?) / 50) + 1
                 ),
                 user_skills.experience = user_skills.experience + ?,
                 user_skills.experience_to_next_level =
                   (FLOOR((user_skills.experience + ?) / 50) + 1) * 50,
                 user_skills.updated_at = CURRENT_TIMESTAMP
             WHERE user_skills.user_id = ? AND skills.name = ?`,
            [skillExperience, skillExperience, skillExperience, req.user.id, currentMission.reward_key || currentMission.reward_name]
          );
        }

        if (rewardGranted && currentMission.reward_type === 'item') {
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

        if (rewardGranted && currentMission.reward_type === 'badge') {
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
      `SELECT id, category, DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date, frequency, scheduled_time, title, detail, reward, reward_type, reward_name, reward_key,
              completed, completed_at, failed, failed_at, created_at, updated_at
       FROM missions
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND category <> 'guild'
         AND ((frequency = 'daily' AND mission_date = CURDATE())
           OR (frequency = 'weekly' AND mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
           OR (frequency = 'monthly' AND mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
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

async function cancel(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Data yang diberikan tidak valid.',
        errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await markExpiredMissions(req.user.id, connection);

      const [missions] = await connection.query(
        `SELECT id, category, title, reward, reward_type, reward_key, completed, failed
         FROM missions
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND category <> 'guild'
           AND ((frequency = 'daily' AND mission_date = CURDATE())
             OR (frequency = 'weekly' AND mission_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
             OR (frequency = 'monthly' AND mission_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')))
         LIMIT 1 FOR UPDATE`,
        [req.params.id, req.user.id]
      );

      if (!missions.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Misi tidak ditemukan.' });
      }

      const mission = missions[0];
      if (mission.failed) {
        await connection.rollback();
        return res.status(409).json({ message: 'Misi yang gagal tidak dapat dibatalkan.' });
      }
      if (!mission.completed) {
        await connection.rollback();
        return res.status(409).json({ message: 'Misi belum selesai.' });
      }

      const [rewards] = await connection.query(
        `SELECT id, reward_type, amount
         FROM user_rewards
         WHERE user_id = ? AND mission_id = ? AND deleted_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [req.user.id, mission.id]
      );
      const reward = rewards[0];

      if (mission.reward_type === 'xp') {
        const amount = reward?.amount || mission.reward;
        await reverseMissionExperience(connection, req.user.id, mission, amount);
      } else if (mission.reward_type === 'skill') {
        const skillKey = mission.reward_key || mission.reward_name;
        const skillExperience = Math.max(mission.reward || 0, 10);
        const [skillsToUpdate] = await connection.query(
          'SELECT id FROM skills WHERE name = ? LIMIT 1',
          [skillKey]
        );

        if (skillsToUpdate.length) {
          await connection.query(
            `UPDATE user_skills
             SET level = FLOOR(GREATEST(experience - ?, 0) / 50) + 1,
                 experience_to_next_level =
                   (FLOOR(GREATEST(experience - ?, 0) / 50) + 1) * 50,
                 experience = GREATEST(experience - ?, 0),
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_skills.user_id = ? AND user_skills.skill_id = ?`,
            [skillExperience, skillExperience, skillExperience, req.user.id, skillsToUpdate[0].id]
          );
        }
      } else if (mission.reward_type === 'item') {
        await connection.query(
          `UPDATE user_inventory
           SET quantity = GREATEST(quantity - 1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND item_key = ?`,
          [req.user.id, mission.reward_key]
        );
      }

      if (reward) {
        await connection.query('UPDATE user_rewards SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL', [reward.id]);
      }
      await connection.query(
        `UPDATE missions
         SET completed = 0, completed_at = NULL
         WHERE id = ? AND user_id = ?`,
        [mission.id, req.user.id]
      );
      await syncMissionStatus(connection, {
        ...mission,
        completed: false,
        completed_at: null,
        failed: Boolean(mission.failed),
        failed_at: null,
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.json({
      message: 'Penyelesaian misi berhasil dibatalkan.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, toggle, cancel };
