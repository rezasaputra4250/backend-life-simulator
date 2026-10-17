const { validationResult } = require('express-validator');
const pool = require('../config/database');

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;

  return res.status(422).json({
    message: 'Data party tidak valid.',
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

async function areFriends(userA, userB) {
  const [userOneId, userTwoId] = [Math.min(Number(userA), Number(userB)), Math.max(Number(userA), Number(userB))];
  const [rows] = await pool.query(
    'SELECT id FROM friendships WHERE user_one_id = ? AND user_two_id = ? AND deleted_at IS NULL LIMIT 1',
    [userOneId, userTwoId]
  );
  return rows.length > 0;
}

async function list(req, res, next) {
  try {
    const [parties] = await pool.query(
      `SELECT parties.id, parties.name, parties.owner_id, parties.max_members,
              parties.created_at, COUNT(party_members.id) AS member_count
       FROM parties
       INNER JOIN party_members ON party_members.party_id = parties.id
       WHERE parties.deleted_at IS NULL AND party_members.deleted_at IS NULL
         AND party_members.user_id = ?
       GROUP BY parties.id
       ORDER BY parties.updated_at DESC`,
      [req.user.id]
    );
    const [members] = await pool.query(
      `SELECT party_members.party_id, users.id, users.name, users.email, party_members.role
       FROM party_members
       INNER JOIN users ON users.id = party_members.user_id
       WHERE party_members.deleted_at IS NULL
         AND users.deleted_at IS NULL
         AND party_members.party_id IN (
         SELECT party_id FROM party_members WHERE user_id = ? AND deleted_at IS NULL
       )
       ORDER BY users.name ASC`,
      [req.user.id]
    );
    return res.json({
      message: 'Data party berhasil diambil.',
      parties: parties.map((party) => ({
        ...party,
        members: members.filter((member) => Number(member.party_id) === Number(party.id)),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [partyResult] = await connection.query(
        'INSERT INTO parties (owner_id, name, max_members) VALUES (?, ?, ?)',
        [req.user.id, req.body.name, req.body.max_members || 5]
      );
      await connection.query(
        "INSERT INTO party_members (party_id, user_id, role) VALUES (?, ?, 'owner')",
        [partyResult.insertId, req.user.id]
      );
      await connection.commit();
      return res.status(201).json({
        message: 'Party berhasil dibuat.',
        party: { id: partyResult.insertId, name: req.body.name, max_members: req.body.max_members || 5 },
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

async function addMember(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const [parties] = await pool.query(
      'SELECT id, max_members FROM parties WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!parties.length) return res.status(404).json({ message: 'Party tidak ditemukan atau kamu bukan pemiliknya.' });

    if (!(await areFriends(req.user.id, req.body.user_id))) {
      return res.status(422).json({ message: 'Anggota party harus sudah menjadi teman.' });
    }

    const [members] = await pool.query('SELECT COUNT(*) AS total FROM party_members WHERE party_id = ? AND deleted_at IS NULL', [req.params.id]);
    if (Number(members[0].total) >= parties[0].max_members) {
      return res.status(409).json({ message: 'Party sudah penuh.' });
    }

    const [result] = await pool.query(
      'INSERT IGNORE INTO party_members (party_id, user_id, role) VALUES (?, ?, \'member\')',
      [req.params.id, req.body.user_id]
    );
    if (!result.affectedRows) return res.status(409).json({ message: 'Pengguna sudah berada di party.' });
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'party_invitation', 'Undangan party', ?, JSON_OBJECT('party_id', ?))`,
      [req.body.user_id, `${req.user.name} menambahkanmu ke party.`, req.params.id]
    );
    return res.status(201).json({ message: 'Anggota berhasil ditambahkan ke party.' });
  } catch (error) {
    return next(error);
  }
}

async function removeMember(req, res, next) {
  try {
    const [parties] = await pool.query('SELECT id FROM parties WHERE id = ? AND owner_id = ? LIMIT 1', [req.params.id, req.user.id]);
    if (!parties.length) return res.status(404).json({ message: 'Party tidak ditemukan atau kamu bukan pemiliknya.' });
    const [result] = await pool.query(
      "UPDATE party_members SET deleted_at = CURRENT_TIMESTAMP WHERE party_id = ? AND user_id = ? AND role = 'member' AND deleted_at IS NULL",
      [req.params.id, req.params.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Anggota party tidak ditemukan.' });
    return res.json({ message: 'Anggota berhasil dikeluarkan dari party.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, addMember, removeMember };
