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

async function ensureAccount(connection, userId, accountId = null) {
  await connection.query(
    `INSERT IGNORE INTO financial_accounts (user_id, name, type) VALUES (?, 'Kas Utama', 'cash')`,
    [userId]
  );
  const [accounts] = await connection.query(
    `SELECT id, user_id, name, type, balance, currency
     FROM financial_accounts
     WHERE user_id = ? AND (? IS NULL OR id = ?)
     ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [userId, accountId, accountId]
  );
  return accounts[0] || null;
}

async function recalculateAccount(connection, accountId, userId) {
  const [transactions] = await connection.query(
    `SELECT id, type, amount FROM financial_transactions
     WHERE account_id = ? AND user_id = ?
     ORDER BY occurred_at ASC, id ASC FOR UPDATE`,
    [accountId, userId]
  );
  let balance = 0;
  for (const transaction of transactions) {
    balance += transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount);
    if (balance < 0) return null;
    await connection.query(
      'UPDATE financial_transactions SET balance_after = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [balance, transaction.id]
    );
  }
  await connection.query(
    'UPDATE financial_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [balance, accountId, userId]
  );
  return balance;
}

async function syncWalletBalance(connection, walletId, userId) {
  const [balances] = await connection.query(
    'SELECT COALESCE(SUM(balance), 0) AS balance FROM financial_accounts WHERE user_id = ?',
    [userId]
  );
  await connection.query(
    'UPDATE financial_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [balances[0].balance, walletId, userId]
  );
  return Number(balances[0].balance);
}

async function summary(req, res, next) {
  try {
    const [wallets] = await pool.query(
      'SELECT id, balance, currency, updated_at FROM financial_wallets WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const [accounts] = await pool.query(
      `SELECT id, name, type, balance, currency, updated_at
       FROM financial_accounts WHERE user_id = ? ORDER BY id ASC`,
      [req.user.id]
    );
    const [totals] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
       FROM financial_transactions WHERE user_id = ?`,
      [req.user.id]
    );
    return res.json({
      message: 'Ringkasan keuangan berhasil diambil.',
      wallet: wallets[0] || { id: null, balance: 0, currency: 'IDR' },
      accounts,
      totals: totals[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function listAccounts(req, res, next) {
  try {
    const [accounts] = await pool.query(
      'SELECT id, name, type, balance, currency, updated_at FROM financial_accounts WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );
    return res.json({ message: 'Daftar akun keuangan berhasil diambil.', accounts });
  } catch (error) {
    return next(error);
  }
}

async function createAccount(req, res, next) {
  const errorResponse = validationErrorResponse(req, res);
  if (errorResponse) return errorResponse;
  try {
    const [result] = await pool.query(
      'INSERT INTO financial_accounts (user_id, name, type) VALUES (?, ?, ?)',
      [req.user.id, req.body.name.trim(), req.body.type || 'other']
    );
    const [accounts] = await pool.query(
      'SELECT id, name, type, balance, currency, updated_at FROM financial_accounts WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    return res.status(201).json({ message: 'Akun keuangan berhasil dibuat.', account: accounts[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nama akun sudah digunakan.' });
    return next(error);
  }
}

async function listTransactions(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const [transactions] = await pool.query(
      `SELECT transactions.id, transactions.account_id, accounts.name AS account_name,
              transactions.type, transactions.amount, transactions.balance_after,
              transactions.category, transactions.description, transactions.occurred_at, transactions.created_at
       FROM financial_transactions AS transactions
       LEFT JOIN financial_accounts AS accounts ON accounts.id = transactions.account_id
       WHERE transactions.user_id = ? ORDER BY transactions.occurred_at DESC, transactions.id DESC LIMIT ?`,
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
  const { type, amount, category, description, occurred_at, account_id: accountId } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const wallet = await ensureWallet(connection, req.user.id);
    const account = await ensureAccount(connection, req.user.id, accountId || null);
    if (!account) {
      await connection.rollback();
      return res.status(404).json({ message: 'Akun keuangan tidak ditemukan.' });
    }
    const numericAmount = Number(amount);
    const nextBalance = type === 'income' ? Number(account.balance) + numericAmount : Number(account.balance) - numericAmount;
    if (nextBalance < 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Saldo akun tidak mencukupi untuk pengeluaran ini.' });
    }
    const [result] = await connection.query(
      `INSERT INTO financial_transactions
        (wallet_id, account_id, user_id, type, amount, balance_after, category, description, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [wallet.id, account.id, req.user.id, type, numericAmount, nextBalance, category, description || null, occurred_at || null]
    );
    await connection.query('UPDATE financial_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextBalance, account.id]);
    const walletBalance = await syncWalletBalance(connection, wallet.id, req.user.id);
    await connection.commit();
    return res.status(201).json({
      message: type === 'income' ? 'Pemasukan berhasil dicatat.' : 'Pengeluaran berhasil dicatat.',
      transaction: { id: result.insertId, account_id: account.id, type, amount: numericAmount, balance_after: nextBalance, category, description: description || null },
      wallet: { id: wallet.id, balance: walletBalance, currency: wallet.currency },
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

async function updateTransaction(req, res, next) {
  const errorResponse = validationErrorResponse(req, res);
  if (errorResponse) return errorResponse;
  const { type, amount, category, description, occurred_at } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const wallet = await ensureWallet(connection, req.user.id);
    const [transactions] = await connection.query(
      'SELECT id, account_id FROM financial_transactions WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!transactions.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }
    const transaction = transactions[0];
    await connection.query(
      `UPDATE financial_transactions SET type = ?, amount = ?, category = ?, description = ?, occurred_at = COALESCE(?, occurred_at), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [type, Number(amount), category, description || null, occurred_at || null, transaction.id, req.user.id]
    );
    const accountBalance = await recalculateAccount(connection, transaction.account_id, req.user.id);
    if (accountBalance === null) {
      await connection.rollback();
      return res.status(409).json({ message: 'Perubahan membuat saldo akun menjadi negatif.' });
    }
    const walletBalance = await syncWalletBalance(connection, wallet.id, req.user.id);
    await connection.commit();
    return res.json({ message: 'Transaksi berhasil diperbarui.', wallet: { id: wallet.id, balance: walletBalance, currency: wallet.currency } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

module.exports = { summary, listAccounts, createAccount, listTransactions, createTransaction, updateTransaction };
