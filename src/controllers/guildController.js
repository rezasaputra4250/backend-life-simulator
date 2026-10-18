const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { recordGuildContributionReward } = require('../services/rewardService');
const { createGuildMission, syncGuildMissionContribution } = require('../services/missionDomainService');

function guildCapacityForLevel(level) {
  return 10 + (Math.max(1, Number(level) || 1) - 1) * 5;
}

function guildExperienceForNextLevel(level) {
  return Math.max(100, Math.round(100 * Math.pow(1.5, Math.max(0, Number(level) || 1) - 1)));
}

async function addGuildExperience(connection, guildId, amount) {
  const [guilds] = await connection.query(
    'SELECT level, experience, experience_to_next_level FROM guilds WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
    [guildId]
  );
  if (!guilds.length) return;
  let level = Math.max(1, Number(guilds[0].level) || 1);
  let experience = Math.max(0, Number(guilds[0].experience) || 0) + Math.max(0, Number(amount) || 0);
  let experienceToNextLevel = Math.max(100, Number(guilds[0].experience_to_next_level) || guildExperienceForNextLevel(level));
  while (experience >= experienceToNextLevel) {
    experience -= experienceToNextLevel;
    level += 1;
    experienceToNextLevel = guildExperienceForNextLevel(level);
  }
  await connection.query(
    `UPDATE guilds
     SET level = ?, experience = ?, experience_to_next_level = ?, max_members = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [level, experience, experienceToNextLevel, guildCapacityForLevel(level), guildId]
  );
}

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
              guilds.level, guilds.experience, guilds.experience_to_next_level,
              guilds.max_members, guilds.created_at,
              COUNT(all_members.id) AS member_count
       FROM guilds
       INNER JOIN guild_members AS current_members ON current_members.guild_id = guilds.id
         AND current_members.deleted_at IS NULL AND current_members.user_id = ?
       INNER JOIN guild_members AS all_members ON all_members.guild_id = guilds.id
         AND all_members.deleted_at IS NULL
       WHERE guilds.deleted_at IS NULL
       GROUP BY guilds.id, guilds.name, guilds.description, guilds.owner_id,
                guilds.level, guilds.experience, guilds.experience_to_next_level,
                guilds.max_members, guilds.created_at
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
    const [joinRequests] = await pool.query(
      `SELECT guild_join_requests.id, guild_join_requests.guild_id, guild_join_requests.requester_id,
              guild_join_requests.created_at, users.name AS requester_name, users.email AS requester_email
       FROM guild_join_requests
       INNER JOIN guilds ON guilds.id = guild_join_requests.guild_id AND guilds.owner_id = ?
       INNER JOIN users ON users.id = guild_join_requests.requester_id AND users.deleted_at IS NULL
       WHERE guild_join_requests.status = 'pending' AND guild_join_requests.deleted_at IS NULL
       ORDER BY guild_join_requests.created_at ASC`,
      [req.user.id]
    );
    const [canonicalMissions] = await pool.query(
      `SELECT missions.id, missions.guild_id, missions.user_id AS creator_id,
              missions.title, missions.detail, missions.difficulty,
              missions.target_progress, missions.current_progress,
              missions.reward AS reward_xp, DATE_FORMAT(missions.mission_date, '%Y-%m-%d') AS mission_date,
              missions.scheduled_time, missions.status, missions.completed_at
       FROM missions
       INNER JOIN guild_members ON guild_members.guild_id = missions.guild_id
         AND guild_members.user_id = ? AND guild_members.deleted_at IS NULL
       WHERE missions.deleted_at IS NULL AND missions.category = 'guild'
         AND missions.status = 'active' AND missions.mission_date = CURDATE()
       ORDER BY missions.mission_date ASC, missions.id DESC`,
      [req.user.id]
    );
    return res.json({
      message: 'Data guild berhasil diambil.',
      guilds: guilds.map((guild) => ({
        ...guild,
        members: members.filter((member) => Number(member.guild_id) === Number(guild.id)),
        missions: canonicalMissions.filter((mission) => Number(mission.guild_id) === Number(guild.id)),
      })),
      invitations,
      join_requests: joinRequests,
    });

    // Legacy union kept below until the legacy tables are removed from old installations.
    const [missions] = await pool.query(
      `SELECT * FROM (SELECT guild_missions.legacy_mission_id AS id, guild_missions.guild_id,
              guild_missions.creator_id, guild_missions.title, guild_missions.detail,
              guild_missions.difficulty, guild_missions.target_progress,
              guild_missions.current_progress, guild_missions.reward_xp,
              DATE_FORMAT(guild_missions.mission_date, '%Y-%m-%d') AS mission_date,
              guild_missions.scheduled_time, guild_missions.status, guild_missions.completed_at
       FROM guild_missions
       WHERE guild_missions.deleted_at IS NULL
         AND guild_missions.guild_id IN (SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL)
         AND guild_missions.status = 'active'

      UNION ALL
      SELECT missions.id, missions.guild_id, missions.user_id AS creator_id,
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
      ) AS active_guild_missions
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

async function search(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.status(422).json({ message: 'Masukkan minimal 2 karakter untuk mencari guild.' });
    const [guilds] = await pool.query(
      `SELECT guilds.id, guilds.name, guilds.description, guilds.owner_id,
              guilds.level, guilds.experience, guilds.experience_to_next_level, guilds.max_members,
              users.name AS owner_name, COUNT(guild_members.id) AS member_count,
              MAX(CASE WHEN guild_members.user_id = ? THEN 1 ELSE 0 END) AS is_member,
              MAX(CASE WHEN guild_join_requests.requester_id = ? AND guild_join_requests.status = 'pending' THEN 1 ELSE 0 END) AS has_pending_request
       FROM guilds
       INNER JOIN users ON users.id = guilds.owner_id AND users.deleted_at IS NULL
       LEFT JOIN guild_members ON guild_members.guild_id = guilds.id AND guild_members.deleted_at IS NULL
       LEFT JOIN guild_join_requests ON guild_join_requests.guild_id = guilds.id AND guild_join_requests.deleted_at IS NULL
       WHERE guilds.deleted_at IS NULL AND (guilds.name LIKE ? OR guilds.description LIKE ?)
       GROUP BY guilds.id, guilds.name, guilds.description, guilds.owner_id,
                guilds.level, guilds.experience, guilds.experience_to_next_level,
                guilds.max_members, users.name
       ORDER BY guilds.updated_at DESC, guilds.name ASC LIMIT 30`,
      [req.user.id, req.user.id, `%${query}%`, `%${query}%`]
    );
    return res.json({ message: 'Hasil pencarian guild berhasil diambil.', guilds });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;
    const [guilds] = await pool.query(
      `SELECT guilds.id, guilds.name, guilds.description, guilds.level,
              guilds.experience, guilds.experience_to_next_level, guilds.max_members,
              (SELECT COUNT(*) FROM guild_members WHERE guild_members.guild_id = guilds.id AND guild_members.deleted_at IS NULL) AS member_count
       FROM guilds WHERE guilds.id = ? AND guilds.owner_id = ? AND guilds.deleted_at IS NULL LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (!guilds.length) return res.status(404).json({ message: 'Guild tidak ditemukan atau kamu bukan pemiliknya.' });
    const guild = guilds[0];
    await pool.query(
      `UPDATE guilds SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [req.body.name.trim(), req.body.description || null, guild.id, req.user.id]
    );
    const [updatedGuilds] = await pool.query(
      `SELECT id, name, description, owner_id, level, experience, experience_to_next_level, max_members, created_at
       FROM guilds WHERE id = ? LIMIT 1`,
      [guild.id]
    );
    return res.json({ message: 'Guild berhasil diperbarui.', guild: { ...updatedGuilds[0], member_count: guild.member_count } });
  } catch (error) {
    return next(error);
  }
}

async function requestJoin(req, res, next) {
  try {
    const [guilds] = await pool.query(
      'SELECT id, owner_id, max_members FROM guilds WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [req.params.id]
    );
    if (!guilds.length) return res.status(404).json({ message: 'Guild tidak ditemukan.' });
    const guild = guilds[0];
    if (Number(guild.owner_id) === Number(req.user.id)) return res.status(409).json({ message: 'Kamu sudah menjadi pemilik guild ini.' });
    const [memberships] = await pool.query(
      'SELECT id FROM guild_members WHERE guild_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [guild.id, req.user.id]
    );
    if (memberships.length) return res.status(409).json({ message: 'Kamu sudah menjadi anggota guild ini.' });
    const [existing] = await pool.query(
      'SELECT id, status FROM guild_join_requests WHERE guild_id = ? AND requester_id = ? LIMIT 1',
      [guild.id, req.user.id]
    );
    if (existing[0]?.status === 'pending') return res.status(409).json({ message: 'Permintaan bergabung sudah dikirim.' });
    if (existing.length) {
      await pool.query(
        `UPDATE guild_join_requests SET status = 'pending', updated_at = CURRENT_TIMESTAMP, deleted_at = NULL
         WHERE id = ?`,
        [existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO guild_join_requests (guild_id, requester_id, status) VALUES (?, ?, 'pending')`,
        [guild.id, req.user.id]
      );
    }
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'guild_join_request', 'Permintaan bergabung guild', ?, JSON_OBJECT('guild_id', ?, 'requester_id', ?))`,
      [guild.owner_id, `${req.user.name} ingin bergabung ke guild kamu.`, guild.id, req.user.id]
    );
    return res.status(201).json({ message: 'Permintaan bergabung berhasil dikirim.' });
  } catch (error) {
    return next(error);
  }
}

async function respondJoinRequest(req, res, next) {
  const errorResponse = validationErrorResponse(req, res);
  if (errorResponse) return errorResponse;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Serialize approvals for the same requester before locking any request row.
    const [requesterRows] = await connection.query(
      `SELECT users.id FROM users
       INNER JOIN guild_join_requests ON guild_join_requests.requester_id = users.id
       WHERE guild_join_requests.id = ? LIMIT 1 FOR UPDATE`,
      [req.params.id]
    );
    if (!requesterRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Permintaan bergabung tidak ditemukan.' });
    }
    const [requests] = await connection.query(
      `SELECT requests.id, requests.guild_id, requests.requester_id, guilds.max_members,
              guilds.name AS guild_name
       FROM guild_join_requests AS requests
       INNER JOIN guilds ON guilds.id = requests.guild_id AND guilds.owner_id = ? AND guilds.deleted_at IS NULL
       WHERE requests.id = ? AND requests.status = 'pending' AND requests.deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      [req.user.id, req.params.id]
    );
    if (!requests.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Permintaan bergabung tidak ditemukan atau kamu bukan pemilik guild.' });
    }
    const request = requests[0];
    if (req.body.action === 'reject') {
      await connection.query("UPDATE guild_join_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [request.id]);
      await connection.commit();
      return res.json({ message: 'Permintaan bergabung ditolak.' });
    }
    const [memberCount] = await connection.query(
      'SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ? AND deleted_at IS NULL',
      [request.guild_id]
    );
    if (Number(memberCount[0].total) >= Number(request.max_members)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Guild sudah penuh.' });
    }
    const [otherGuilds] = await connection.query(
      'SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
      [request.requester_id]
    );
    if (otherGuilds.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Pengguna tersebut sudah memiliki guild.' });
    }
    await connection.query(
      "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'member')",
      [request.guild_id, request.requester_id]
    );
    await connection.query("UPDATE guild_join_requests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [request.id]);
    await connection.query(
      `UPDATE guild_join_requests
       SET status = 'rejected', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE requester_id = ? AND status = 'pending' AND id <> ? AND deleted_at IS NULL`,
      [request.requester_id, request.id]
    );
    await connection.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'guild_join_request_approved', 'Permintaan guild disetujui', ?, JSON_OBJECT('guild_id', ?))`,
      [request.requester_id, `Permintaanmu untuk bergabung ke ${request.guild_name} disetujui.`, request.guild_id]
    );
    await connection.commit();
    return res.json({ message: 'Pengguna berhasil bergabung ke guild.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
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
    await syncGuildMissionContribution(connection, mission, req.user.id, applied, nextProgress, completed);
    await connection.query(
      `UPDATE missions
       SET current_progress = ?, status = ?, completed = ?, completed_at = ?
       WHERE id = ?`,
      [nextProgress, completed ? 'completed' : 'active', completed ? 1 : 0, completed ? new Date() : null, mission.id]
    );
    await addGuildExperience(connection, mission.guild_id, applied * 10);
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
      const [existingMemberships] = await connection.query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [req.user.id]
      );
      if (existingMemberships.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Setiap pengguna hanya dapat memiliki satu guild.' });
      }
      const [result] = await connection.query(
        'INSERT INTO guilds (owner_id, name, description, level, experience, experience_to_next_level, max_members) VALUES (?, ?, ?, 1, 0, 100, 10)',
        [req.user.id, req.body.name, req.body.description || null]
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
          level: 1,
          experience: 0,
          experience_to_next_level: 100,
          max_members: 10,
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
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('guild_members_active_user_unique')) {
      return res.status(409).json({ message: 'Setiap pengguna hanya dapat memiliki satu guild.' });
    }
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
    const [targetMemberships] = await pool.query(
      'SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      [targetId]
    );
    if (targetMemberships.length) return res.status(409).json({ message: 'Pengguna tersebut sudah memiliki guild.' });
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
      const [existingMemberships] = await connection.query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [req.user.id]
      );
      if (existingMemberships.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Kamu sudah memiliki guild.' });
      }
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

module.exports = { list, search, create, update, requestJoin, respondJoinRequest, createMission, contributeMission, invite, respond };
