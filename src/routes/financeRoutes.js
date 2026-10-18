const express = require('express');
const { body, query } = require('express-validator');
const financeController = require('../controllers/financeController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', financeController.summary);
router.get('/accounts', financeController.listAccounts);
router.post('/accounts', [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Nama akun minimal 2 karakter.'),
  body('type').optional().isIn(['cash', 'bank', 'e_wallet', 'other']).withMessage('Jenis akun tidak valid.'),
], financeController.createAccount);
router.get('/transactions', query('limit').optional().isInt({ min: 1, max: 100 }), financeController.listTransactions);
const transactionValidators = [
  body('type').isIn(['income', 'expense', 'transfer']).withMessage('Jenis transaksi tidak valid.'),
  body('amount').isInt({ min: 1 }).withMessage('Nominal harus berupa bilangan bulat positif.'),
  body('account_id').optional().isInt({ min: 1 }).withMessage('Akun transaksi tidak valid.'),
  body('from_account_id').optional().isInt({ min: 1 }).withMessage('Akun asal tidak valid.'),
  body('to_account_id').optional().isInt({ min: 1 }).withMessage('Akun tujuan tidak valid.'),
  body('category').trim().isLength({ min: 1, max: 80 }).withMessage('Kategori wajib diisi.'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 255 }).withMessage('Deskripsi maksimal 255 karakter.'),
  body('occurred_at').optional({ values: 'null' }).isISO8601().withMessage('Waktu transaksi harus berformat ISO 8601.'),
];
router.post('/transactions', transactionValidators, financeController.createTransaction);
router.patch('/transactions/:id', transactionValidators, financeController.updateTransaction);

module.exports = router;
