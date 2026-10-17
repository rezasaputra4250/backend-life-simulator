const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { recordGuildContributionReward } = require('../services/rewardService');
const { createGuildMission, syncGuildMissionContribution } = require('../services/missionDomainService');

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(422).json({
    message: 'Data guild tidak valid.',
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

async function list(req, res, next) {
  try {
    const [guilds] = await pool.query(
      `SELECT guilds.id, guilds.name, guilds.description, guilds.owner_id,
              guilds.max_members, guilds.created_at,
              COUNT(guild_members.id) AS member_count
       FROM guilds
       INNER JOIN guild_members ON guild_members.guild_id = guilds.id
       WHERE guilds.deleted_at IS NULL AND guild_members.deleted_at IS NULL
         AND guild_members.user_id = ?
       GROUP BY guilds.id
       ORDER BY guilds.updated_at DESC`,
      [req.user.id]
    );
    const [members] = await pool.query(
      `SELECT guild_members.guild_id, users.id, users.name, users.email, guild_members.role
       FROM guild_members
       INNER JOIN users ON users.id = guild_members.user_id
       WHERE guild_members.deleted_at IS NULL AND users.deleted_at IS NULL
         AND guild_members.guild_id IN (
         SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL
       )
       ORDER BY users.name ASC`,
      [req.user.id]
    );
    const [invitations] = await pool.query(
      `SELECT guild_invitations.id, guild_invitations.guild_id, guild_invitations.created_at,
              guilds.name AS guild_name, users.name AS inviter_name, users.email AS inviter_email
       FROM guild_invitations
       INNER JOIN guilds ON guilds.id = guild_invitations.guild_id
       INNER JOIN users ON users.id = guild_invitations.inviter_id
       WHERE guild_invitations.deleted_at IS NULL AND guilds.deleted_at IS NULL
         AND guild_invitations.invitee_id = ? AND guild_invitations.status = 'pending'
       ORDER BY guild_invitations.created_at DESC`,
      [req.user.id]
    );
    const [missions] = await pool.query(
      `SELECT * FROM ((SELECT guild_missions.legacy_mission_id AS id, guild_missions.guild_id,
              guild_missions.creator_id, guild_missions.title, guild_missions.detail,
              guild_missions.difficulty, guild_missions.target_progress,
              guild_missions.current_progress, guild_missions.reward_xp,
              DATE_FORMAT(guild_missions.mission_date, '%Y-%m-%d') AS mission_date,
              guild_missions.scheduled_time, guild_missions.status, guild_missions.completed_at
       FROM guild_missions
       WHERE guild_missions.deleted_at IS NULL
         AND guild_missions.guild_id IN (SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL)
         AND guild_missions.status = 'active'
      )
      UNION ALL
      (SELECT missions.id, missions.guild_id, missions.user_id AS creator_id,
              missions.title, missions.detail, missions.difficulty,
              missions.target_progress, missions.current_progress,
              missions.reward AS reward_xp, DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.scheduled_time, missions.status, missions.completed_at
       FROM missions
       INNER JOIN guild_members ON guild_members.guild_id = missions.guild_id
         AND guild_members.user_id = ? AND guild_members.deleted_at IS NULL
       WHERE missions.deleted_at IS NULL AND missions.category = 'guild'
         AND missions.status = 'active'
         AND missions.mission_date = CURDATE()
         AND NOT EXISTS (SELECT 1 FROM guild_missions WHERE legacy_mission_id = missions.id)
      )) AS active_guild_missions
      ORDER BY active_guild_missions.mission_date ASC, active_guild_missions.id DESC`,
      [req.user.id, req.user.id]
    );

    return res.json({
      message: 'Data guild berhasil diambil.',
      guilds: guilds.map((guild) => ({
        ...guild,
        members: members.filter((member) => Number(member.guild_id) === Number(guild.id)),
        missions: missions.filter((mission) => Number(mission.guild_id) === Number(guild.id)),
      })),
      invitations,
    });
  } catch (error) {
    return next(error);
  }
}

async function createMission(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [guilds] = await connection.query(
        'SELECT id FROM guilds WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [req.params.id, req.user.id]
      );
      if (!guilds.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Guild tidak ditemukan atau kamu bukan pemiliknya.' });
      }

      const difficulty = ['easy', 'normal', 'hard', 'expert'].includes(req.body.difficulty) ? req.body.difficulty : 'easy';
      const [difficultyRows] = await connection.query(
        'SELECT base_reward_xp FROM difficulty_configs WHERE difficulty = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
        [difficulty]
      );
      const rewardXp = Number(difficultyRows[0]?.base_reward_xp || 5);
      const grantPlayerExperience = req.body.grant_player_experience === true;
      const missionId = await createGuildMission(connection, {
        user_id: req.user.id,
        guild_id: req.params.id,
        mission_date: req.body.mission_date,
        scheduled_time: req.body.scheduled_time,
        title: req.body.title,
        detail: req.body.detail,
        difficulty,
        target_progress: req.body.target_progress || 1,
        reward: rewardXp,
        reward_type: 'xp',
        reward_name: `${rewardXp} XP untuk kontribusi`,
        reward_key: 'xp',
        grant_player_experience: grantPlayerExperience,
      });
      await connection.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         SELECT guild_members.user_id, 'guild_mission', 'Misi guild baru', ?, JSON_OBJECT('guild_id', ?, 'mission_id', ?)
         FROM guild_members WHERE guild_members.guild_id = ? AND guild_members.user_id <> ? AND guild_members.deleted_at IS NULL`,
        [`Guild memiliki misi baru: ${req.body.title}.`, req.params.id, missionId, req.params.id, req.user.id]
      );
      const [missions] = await connection.query(
        `SELECT id, guild_id, user_id, user_id AS creator_id, title, detail, difficulty,
                target_progress, current_progress, reward, reward AS reward_xp, grant_player_experience, scheduled_time,
                DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date, status, completed_at
         FROM missions WHERE id = ? AND deleted_at IS NULL`,
        [missionId]
      );
      await connection.commit();
      return res.status(201).json({ message: 'Misi guild berhasil dibuat.', data: missions[0] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) { return next(error); }
}

async function contributeMission(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const amount = Number(req.body.amount || 1);
    await connection.beginTransaction();
    const [missions] = await connection.query(
      `SELECT missions.* FROM missions
       INNER JOIN guild_members ON guild_members.guild_id = missions.guild_id
       WHERE missions.id = ? AND missions.guild_id = ? AND missions.category = 'guild'
         AND missions.deleted_at IS NULL AND guild_members.deleted_at IS NULL
         AND guild_members.user_id = ? AND missions.status = 'active'
       LIMIT 1 FOR UPDATE`,
      [req.params.missionId, req.params.guildId, req.user.id]
    );
    if (!missions.length) { await connection.rollback(); return res.status(404).json({ message: 'Misi guild tidak ditemukan atau kamu bukan anggota guild.' }); }
    const mission = missions[0];
    const remaining = Math.max(0, Number(mission.target_progress) - Number(mission.current_progress));
    const applied = Math.min(Math.max(1, amount), remaining);
    if (!applied) { await connection.rollback(); return res.status(409).json({ message: 'Misi guild sudah mencapai target.' }); }
    await connection.query(
      `INSERT INTO mission_contributions (mission_id, user_id, amount)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount)`,
      [mission.id, req.user.id, applied]
    );
    const nextProgress = Number(mission.current_progress) + applied;
    const completed = nextProgress >= Number(mission.target_progress);
    await connection.query(
      `UPDATE missions
       SET current_progress = ?, status = ?, completed = ?, completed_at = ?
       WHERE id = ?`,
      [nextProgress, completed ? 'completed' : 'active', completed ? 1 : 0, completed ? new Date() : null, mission.id]
    );
    await syncGuildMissionContribution(connection, mission, req.user.id, applied, nextProgress, completed);
    const reward = Math.max(1, Math.floor(Number(mission.reward) * applied / Number(mission.target_progress)));
    const rewardResult = await recordGuildContributionReward(connection, req.user.id, mission, reward);
    await connection.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       SELECT guild_members.user_id, 'guild_mission_progress', 'Progress misi guild', ?, JSON_OBJECT('mission_id', ?)
       FROM guild_members WHERE guild_members.guild_id = ? AND guild_members.user_id <> ? AND guild_members.deleted_at IS NULL`,
      [`${req.user.name} menambah progress misi guild ${applied}.`, mission.id, mission.guild_id, req.user.id]
    );
    await connection.commit();
    return res.json({ message: completed ? 'Misi guild selesai.' : 'Progress misi guild berhasil ditambahkan.', data: { mission_id: mission.id, applied, current_progress: nextProgress, target_progress: mission.target_progress, completed, reward_xp: rewardResult.amount } });
  } catch (error) { await connection.rollback(); return next(error); }
  finally { connection.release(); }
}

async function create(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO guilds (owner_id, name, description, max_members) VALUES (?, ?, ?, ?)',
        [req.user.id, req.body.name, req.body.description || null, req.body.max_members || 20]
      );
      await connection.query(
        "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'owner')",
        [result.insertId, req.user.id]
      );
      await connection.commit();
      return res.status(201).json({
        message: 'Guild berhasil dibuat.',
        guild: {
          id: result.insertId,
          name: req.body.name,
          description: req.body.description || null,
          owner_id: req.user.id,
          max_members: req.body.max_members || 20,
          member_count: 1,
          members: [{ id: req.user.id, name: req.user.name, email: req.user.email, role: 'owner' }],
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
}

async function invite(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;
    const [guilds] = await pool.query(
      'SELECT id, max_members FROM guilds WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!guilds.length) return res.status(404).json({ message: 'Guild tidak ditemukan atau kamu bukan pemiliknya.' });
    const targetId = Number(req.body.user_id);
    if (targetId === Number(req.user.id)) return res.status(422).json({ message: 'Kamu sudah menjadi pemilik guild.' });
    const [friendships] = await pool.query(
      `SELECT id FROM friendships WHERE user_one_id = ? AND user_two_id = ? AND deleted_at IS NULL LIMIT 1`,
      [Math.min(req.user.id, targetId), Math.max(req.user.id, targetId)]
    );
    if (!friendships.length) return res.status(403).json({ message: 'Kamu hanya dapat mengundang teman.' });
    const [members] = await pool.query(
      'SELECT id FROM guild_members WHERE guild_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [req.params.id, targetId]
    );
    if (members.length) return res.status(409).json({ message: 'Pengguna sudah menjadi anggota guild.' });
    const [count] = await pool.query('SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ? AND deleted_at IS NULL', [req.params.id]);
    if (Number(count[0].total) >= Number(guilds[0].max_members)) return res.status(409).json({ message: 'Guild sudah penuh.' });
    await pool.query(
      `INSERT INTO guild_invitations (guild_id, inviter_id, invitee_id, status)
       VALUES (?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE inviter_id = VALUES(inviter_id), status = 'pending', updated_at = CURRENT_TIMESTAMP`,
      [req.params.id, req.user.id, targetId]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'guild_invitation', 'Undangan guild', ?, JSON_OBJECT('guild_id', ?))`,
      [targetId, `${req.user.name} mengundangmu ke guild.`, req.params.id]
    );
    return res.status(201).json({ message: 'Undangan guild berhasil dikirim.' });
  } catch (error) {
    return next(error);
  }
}

async function respond(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;
    const [invitations] = await pool.query(
      'SELECT id, guild_id FROM guild_invitations WHERE id = ? AND invitee_id = ? AND status = \'pending\' LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!invitations.length) return res.status(404).json({ message: 'Undangan guild tidak ditemukan.' });
    const invitation = invitations[0];
    if (req.body.action === 'reject') {
      await pool.query('UPDATE guild_invitations SET status = \'rejected\' WHERE id = ?', [invitation.id]);
      return res.json({ message: 'Undangan guild ditolak.' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [guilds] = await connection.query('SELECT max_members FROM guilds WHERE id = ? AND deleted_at IS NULL LIMIT 1', [invitation.guild_id]);
      const [count] = await connection.query('SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ? AND deleted_at IS NULL', [invitation.guild_id]);
      if (!guilds.length || Number(count[0].total) >= Number(guilds[0].max_members)) {
        await connection.rollback();
        return res.status(409).json({ message: 'Guild sudah penuh.' });
      }
      await connection.query("INSERT IGNORE INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'member')", [invitation.guild_id, req.user.id]);
      await connection.query("UPDATE guild_invitations SET status = 'accepted' WHERE id = ?", [invitation.id]);
      await connection.commit();
      return res.json({ message: 'Kamu bergabung ke guild.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, createMission, contributeMission, invite, respond };
