const { validationResult } = require('express-validator');
const pool = require('../config/database');

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(422).json({
    message: 'Data keuangan yang diberikan tidak valid.',
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  });
}

async function ensureWallet(connection, userId) {
  await connection.query('INSERT IGNORE INTO financial_wallets (user_id) VALUES (?)', [userId]);
  const [wallets] = await connection.query(
    'SELECT id, balance, currency FROM financial_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE',
    [userId]
  );
  return wallets[0];
}

async function summary(req, res, next) {
  try {
    const [wallets] = await pool.query(
      'SELECT id, balance, currency, updated_at FROM financial_wallets WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const wallet = wallets[0] || { id: null, balance: 0, currency: 'IDR' };
    const [totals] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
       FROM financial_transactions WHERE user_id = ?`,
      [req.user.id]
    );
    return res.json({
      message: 'Ringkasan keuangan berhasil diambil.',
      wallet,
      totals: totals[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function listTransactions(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const [transactions] = await pool.query(
      `SELECT id, type, amount, balance_after, category, description, occurred_at, created_at
       FROM financial_transactions WHERE user_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ?`,
      [req.user.id, limit]
    );
    return res.json({ message: 'Riwayat transaksi berhasil diambil.', transactions });
  } catch (error) {
    return next(error);
  }
}

async function createTransaction(req, res, next) {
  const errorResponse = validationErrorResponse(req, res);
  if (errorResponse) return errorResponse;

  const { type, amount, category, description, occurred_at } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const wallet = await ensureWallet(connection, req.user.id);
    const numericAmount = Number(amount);
    const nextBalance = type === 'income'
      ? Number(wallet.balance) + numericAmount
      : Number(wallet.balance) - numericAmount;

    if (nextBalance < 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Saldo tidak mencukupi untuk pengeluaran ini.' });
    }

    const [result] = await connection.query(
      `INSERT INTO financial_transactions
        (wallet_id, user_id, type, amount, balance_after, category, description, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [wallet.id, req.user.id, type, numericAmount, nextBalance, category, description || null, occurred_at || null]
    );
    await connection.query(
      'UPDATE financial_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextBalance, wallet.id]
    );
    await connection.commit();
    return res.status(201).json({
      message: type === 'income' ? 'Pemasukan berhasil dicatat.' : 'Pengeluaran berhasil dicatat.',
      transaction: { id: result.insertId, type, amount: numericAmount, balance_after: nextBalance, category, description: description || null },
      wallet: { id: wallet.id, balance: nextBalance, currency: wallet.currency },
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

module.exports = { summary, listTransactions, createTransaction };
