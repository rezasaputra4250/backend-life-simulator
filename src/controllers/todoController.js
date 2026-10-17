const { validationResult } = require('express-validator');
const pool = require('../config/database');

function formatDueDate(value) {
  if (!value) return null;

  const normalized = String(value).trim().replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function validationErrorResponse(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) return null;

  return res.status(422).json({
    message: 'Data to-do tidak valid.',
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
}

async function getOrCreateTodoList(userId) {
  const [lists] = await pool.query(
    `SELECT id FROM todo_lists
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [userId]
  );

  if (lists.length) return lists[0].id;

  const [result] = await pool.query(
    'INSERT INTO todo_lists (user_id, title) VALUES (?, ?)',
    [userId, 'To-do Saya']
  );

  return result.insertId;
}

async function list(req, res, next) {
  try {
    const listId = await getOrCreateTodoList(req.user.id);
    const [items] = await pool.query(
      `SELECT id, todo_list_id, title, description, status, priority,
              DATE_FORMAT(due_date, '%Y-%m-%d %H:%i:%s') AS due_date, completed_at, sort_order, created_at, updated_at
       FROM todo_items
       WHERE todo_list_id = ? AND deleted_at IS NULL
       ORDER BY due_date IS NULL ASC, due_date ASC, sort_order ASC, id ASC`,
      [listId]
    );

    return res.json({
      message: 'Data to-do berhasil diambil.',
      todos: items,
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const { title, description, priority, due_date } = req.body;
    const listId = await getOrCreateTodoList(req.user.id);
    const [result] = await pool.query(
      `INSERT INTO todo_items
         (todo_list_id, assigned_to, title, description, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [listId, req.user.id, title, description || null, priority || 'medium', formatDueDate(due_date)]
    );

    const [items] = await pool.query(
      `SELECT id, todo_list_id, title, description, status, priority,
              DATE_FORMAT(due_date, '%Y-%m-%d %H:%i:%s') AS due_date, completed_at, sort_order, created_at, updated_at
       FROM todo_items WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      message: 'To-do berhasil ditambahkan.',
      todo: items[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const errorResponse = validationErrorResponse(req, res);
    if (errorResponse) return errorResponse;

    const allowedFields = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      priority: req.body.priority,
      due_date: req.body.due_date === undefined ? undefined : formatDueDate(req.body.due_date),
    };
    const updates = Object.entries(allowedFields).filter(([, value]) => value !== undefined);

    if (!updates.length) {
      return res.status(422).json({
        message: 'Minimal satu data to-do harus diubah.',
      });
    }

    const listId = await getOrCreateTodoList(req.user.id);
    const [existingItems] = await pool.query(
      'SELECT id FROM todo_items WHERE id = ? AND todo_list_id = ? AND deleted_at IS NULL LIMIT 1',
      [req.params.id, listId]
    );

    if (!existingItems.length) {
      return res.status(404).json({ message: 'To-do tidak ditemukan.' });
    }

    let setClause = updates.map(([field]) => `${field} = ?`).join(', ');
    const values = updates.map(([, value]) => value);

    if (Object.prototype.hasOwnProperty.call(allowedFields, 'status') && req.body.status !== undefined) {
      setClause += ', completed_at = ?';
      values.push(req.body.status === 'completed' ? new Date() : null);
    }

    await pool.query(
      `UPDATE todo_items SET ${setClause} WHERE id = ? AND todo_list_id = ?`,
      [...values, req.params.id, listId]
    );

    const [items] = await pool.query(
      `SELECT id, todo_list_id, title, description, status, priority,
              DATE_FORMAT(due_date, '%Y-%m-%d %H:%i:%s') AS due_date, completed_at, sort_order, created_at, updated_at
       FROM todo_items WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [req.params.id]
    );

    return res.json({
      message: 'To-do berhasil diperbarui.',
      todo: items[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const listId = await getOrCreateTodoList(req.user.id);
    const [result] = await pool.query(
      'UPDATE todo_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND todo_list_id = ? AND deleted_at IS NULL',
      [req.params.id, listId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'To-do tidak ditemukan.' });
    }

    return res.json({ message: 'To-do berhasil dihapus.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, update, remove };
