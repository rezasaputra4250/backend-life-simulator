const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { grantExperience } = require('../services/progressionService');

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
       WHERE guild_members.user_id = ?
       GROUP BY guilds.id
       ORDER BY guilds.updated_at DESC`,
      [req.user.id]
    );
    const [members] = await pool.query(
      `SELECT guild_members.guild_id, users.id, users.name, users.email, guild_members.role
       FROM guild_members
       INNER JOIN users ON users.id = guild_members.user_id
       WHERE guild_members.guild_id IN (
         SELECT guild_id FROM guild_members WHERE user_id = ?
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
       WHERE guild_invitations.invitee_id = ? AND guild_invitations.status = 'pending'
       ORDER BY guild_invitations.created_at DESC`,
      [req.user.id]
    );
    const [missions] = await pool.query(
      `SELECT missions.id, missions.guild_id, missions.user_id AS creator_id,
              missions.title, missions.detail, missions.difficulty,
              missions.target_progress, missions.current_progress,
              missions.reward AS reward_xp, DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.scheduled_time,
              missions.status, missions.completed_at
       FROM missions
       WHERE missions.category = 'guild'
         AND missions.guild_id IN (SELECT guild_id FROM guild_members WHERE user_id = ?)
         AND missions.status = 'active'
       ORDER BY missions.mission_date ASC, missions.id DESC`,
      [req.user.id]
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
    const [guilds] = await pool.query(
      'SELECT id FROM guilds WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!guilds.length) return res.status(404).json({ message: 'Guild tidak ditemukan atau kamu bukan pemiliknya.' });

    const rewardByDifficulty = { easy: 25, medium: 50, hard: 100, epic: 200 };
    const difficulty = req.body.difficulty || 'easy';
    const rewardXp = Math.min(
      rewardByDifficulty[difficulty],
      Math.max(1, Number(req.body.reward_xp) || rewardByDifficulty[difficulty])
    );
    const [result] = await pool.query(
      `INSERT INTO missions
       (user_id, category, guild_id, mission_date, frequency, scheduled_time, title, detail, difficulty,
        target_progress, current_progress, status, reward, reward_type, reward_name, reward_key, custom_source)
       VALUES (?, 'guild', ?, ?, 'daily', ?, ?, ?, ?, ?, 0, 'active', ?, 'xp', ?, 'xp', 1)`,
      [req.user.id, req.params.id, req.body.mission_date, req.body.scheduled_time || null, req.body.title, req.body.detail || null, difficulty,
        req.body.target_progress || 1, rewardXp,
        `${rewardXp} XP untuk kontribusi`]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       SELECT guild_members.user_id, 'guild_mission', 'Misi guild baru', ?, JSON_OBJECT('guild_id', ?, 'mission_id', ?)
       FROM guild_members WHERE guild_members.guild_id = ? AND guild_members.user_id <> ?`,
      [`Guild memiliki misi baru: ${req.body.title}.`, req.params.id, result.insertId, req.params.id, req.user.id]
    );
    const [missions] = await pool.query(
      `SELECT id, guild_id, user_id AS creator_id, title, detail, difficulty,
              target_progress, current_progress, reward AS reward_xp, scheduled_time,
              DATE_FORMAT(mission_date, '%Y-%m-%d') AS mission_date, status, completed_at
       FROM missions WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ message: 'Misi guild berhasil dibuat.', data: missions[0] });
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
    const reward = Math.max(1, Math.floor(Number(mission.reward_xp) * applied / Number(mission.target_progress)));
    const [rewardTransaction] = await connection.query(
      `INSERT IGNORE INTO reward_transactions (user_id, source_type, source_id, reward_type, amount)
       VALUES (?, 'guild_mission_contribution', ?, 'xp', ?)`,
      [req.user.id, mission.id, reward]
    );
    if (rewardTransaction.affectedRows) await grantExperience(connection, req.user.id, reward, 'guild_mission', mission.title);
    await connection.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       SELECT guild_members.user_id, 'guild_mission_progress', 'Progress misi guild', ?, JSON_OBJECT('mission_id', ?)
       FROM guild_members WHERE guild_members.guild_id = ? AND guild_members.user_id <> ?`,
      [`${req.user.name} menambah progress misi guild ${applied}.`, mission.id, mission.guild_id, req.user.id]
    );
    await connection.commit();
    return res.json({ message: completed ? 'Misi guild selesai.' : 'Progress misi guild berhasil ditambahkan.', data: { mission_id: mission.id, applied, current_progress: nextProgress, target_progress: mission.target_progress, completed, reward_xp: rewardTransaction.affectedRows ? reward : 0 } });
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
      'SELECT id, max_members FROM guilds WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!guilds.length) return res.status(404).json({ message: 'Guild tidak ditemukan atau kamu bukan pemiliknya.' });
    const targetId = Number(req.body.user_id);
    if (targetId === Number(req.user.id)) return res.status(422).json({ message: 'Kamu sudah menjadi pemilik guild.' });
    const [friendships] = await pool.query(
      `SELECT id FROM friendships WHERE user_one_id = ? AND user_two_id = ? LIMIT 1`,
      [Math.min(req.user.id, targetId), Math.max(req.user.id, targetId)]
    );
    if (!friendships.length) return res.status(403).json({ message: 'Kamu hanya dapat mengundang teman.' });
    const [members] = await pool.query(
      'SELECT id FROM guild_members WHERE guild_id = ? AND user_id = ? LIMIT 1',
      [req.params.id, targetId]
    );
    if (members.length) return res.status(409).json({ message: 'Pengguna sudah menjadi anggota guild.' });
    const [count] = await pool.query('SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ?', [req.params.id]);
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
      const [guilds] = await connection.query('SELECT max_members FROM guilds WHERE id = ? LIMIT 1', [invitation.guild_id]);
      const [count] = await connection.query('SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ?', [invitation.guild_id]);
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
