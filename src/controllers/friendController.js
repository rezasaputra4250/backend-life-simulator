const { validationResult } = require('express-validator');
const pool = require('../config/database');

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;

  return res.status(422).json({
    message: 'Data pertemanan tidak valid.',
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

function pair(userA, userB) {
  return [Math.min(Number(userA), Number(userB)), Math.max(Number(userA), Number(userB))];
}

async function list(req, res, next) {
  try {
    const [friends] = await pool.query(
      `SELECT users.id, users.name, users.email, friendships.created_at
       FROM friendships
       INNER JOIN users ON users.id = CASE
         WHEN friendships.user_one_id = ? THEN friendships.user_two_id
         ELSE friendships.user_one_id
       END
       WHERE friendships.user_one_id = ? OR friendships.user_two_id = ?
       ORDER BY users.name ASC`,
      [req.user.id, req.user.id, req.user.id]
    );
    const [requests] = await pool.query(
      `SELECT friend_requests.id, friend_requests.status, friend_requests.created_at,
              users.id AS requester_id, users.name AS requester_name, users.email AS requester_email
       FROM friend_requests
       INNER JOIN users ON users.id = friend_requests.requester_id
       WHERE friend_requests.addressee_id = ? AND friend_requests.status = 'pending'
       ORDER BY friend_requests.created_at DESC`,
      [req.user.id]
    );

    return res.json({ message: 'Data pertemanan berhasil diambil.', friends, requests });
  } catch (error) {
    return next(error);
  }
}

async function search(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) {
      return res.status(422).json({ message: 'Masukkan minimal 2 karakter untuk mencari pengguna.' });
    }

    const searchValue = `%${query}%`;
    const [users] = await pool.query(
      `SELECT users.id, users.name, users.email,
              CASE
                WHEN EXISTS (
                  SELECT 1 FROM friendships
                  WHERE (friendships.user_one_id = LEAST(?, users.id)
                     AND friendships.user_two_id = GREATEST(?, users.id))
                ) THEN 'friends'
                WHEN EXISTS (
                  SELECT 1 FROM friend_requests
                  WHERE friend_requests.requester_id = ?
                    AND friend_requests.addressee_id = users.id
                    AND friend_requests.status = 'pending'
                ) THEN 'request_sent'
                WHEN EXISTS (
                  SELECT 1 FROM friend_requests
                  WHERE friend_requests.requester_id = users.id
                    AND friend_requests.addressee_id = ?
                    AND friend_requests.status = 'pending'
                ) THEN 'request_received'
                ELSE 'none'
              END AS relationship_status
       FROM users
       WHERE users.id <> ? AND (users.name LIKE ? OR users.email LIKE ?)
       ORDER BY users.name ASC
       LIMIT 20`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, searchValue, searchValue]
    );

    return res.json({ message: 'Pengguna berhasil dicari.', users });
  } catch (error) {
    return next(error);
  }
}

async function request(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const targetId = Number(req.body.user_id);
    if (targetId === Number(req.user.id)) {
      return res.status(422).json({ message: 'Kamu tidak dapat menambahkan diri sendiri.' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [targetId]);
    if (!users.length) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });

    const [userOneId, userTwoId] = pair(req.user.id, targetId);
    const [friendships] = await pool.query(
      'SELECT id FROM friendships WHERE user_one_id = ? AND user_two_id = ? LIMIT 1',
      [userOneId, userTwoId]
    );
    if (friendships.length) return res.status(409).json({ message: 'Kalian sudah berteman.' });

    const [existing] = await pool.query(
      `SELECT id, requester_id, addressee_id, status
       FROM friend_requests
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)
       ORDER BY id DESC LIMIT 1`,
      [req.user.id, targetId, targetId, req.user.id]
    );

    if (existing.length && existing[0].status === 'pending') {
      if (existing[0].requester_id === targetId) {
        await pool.query(
          'UPDATE friend_requests SET status = \'accepted\' WHERE id = ?',
          [existing[0].id]
        );
        await pool.query(
          'INSERT IGNORE INTO friendships (user_one_id, user_two_id) VALUES (?, ?)',
          [userOneId, userTwoId]
        );
        return res.json({ message: 'Permintaan pertemanan diterima. Kalian sekarang berteman.', data: { user_id: targetId, status: 'friends' } });
      }
      return res.status(409).json({ message: 'Permintaan pertemanan sudah dikirim.' });
    }

    await pool.query(
      `INSERT INTO friend_requests (requester_id, addressee_id, status)
       VALUES (?, ?, 'pending')
       ON DUPLICATE KEY UPDATE status = 'pending', updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, targetId]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'friend_request', 'Permintaan pertemanan', ?, JSON_OBJECT('requester_id', ?))`,
      [targetId, `${req.user.name} ingin berteman denganmu.`, req.user.id]
    );

    return res.status(201).json({ message: 'Permintaan pertemanan berhasil dikirim.', data: { user_id: targetId, status: 'request_sent' } });
  } catch (error) {
    return next(error);
  }
}

async function respond(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { action } = req.body;
    const [requests] = await pool.query(
      `SELECT id, requester_id, addressee_id
       FROM friend_requests
       WHERE id = ? AND addressee_id = ? AND status = 'pending'
       LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (!requests.length) return res.status(404).json({ message: 'Permintaan pertemanan tidak ditemukan.' });

    const friendRequest = requests[0];
    if (action === 'accept') {
      const [userOneId, userTwoId] = pair(friendRequest.requester_id, friendRequest.addressee_id);
      await pool.query('UPDATE friend_requests SET status = \'accepted\' WHERE id = ?', [friendRequest.id]);
      await pool.query(
        'INSERT IGNORE INTO friendships (user_one_id, user_two_id) VALUES (?, ?)',
        [userOneId, userTwoId]
      );
      return res.json({ message: 'Permintaan pertemanan diterima.' });
    }

    await pool.query('UPDATE friend_requests SET status = \'rejected\' WHERE id = ?', [friendRequest.id]);
    return res.json({ message: 'Permintaan pertemanan ditolak.' });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const [userOneId, userTwoId] = pair(req.user.id, req.params.userId);
    const [result] = await pool.query(
      'DELETE FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
      [userOneId, userTwoId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Pertemanan tidak ditemukan.' });
    return res.json({ message: 'Pertemanan berhasil dihapus.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, search, request, respond, remove };
