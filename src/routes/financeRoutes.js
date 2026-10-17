const express = require('express');
const { body, query } = require('express-validator');
const financeController = require('../controllers/financeController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', financeController.summary);
router.get('/transactions', query('limit').optional().isInt({ min: 1, max: 100 }), financeController.listTransactions);
router.post('/transactions', [
  body('type').isIn(['income', 'expense']).withMessage('Jenis transaksi harus income atau expense.'),
  body('amount').isInt({ min: 1 }).withMessage('Nominal harus berupa bilangan bulat positif.'),
  body('category').trim().isLength({ min: 1, max: 80 }).withMessage('Kategori wajib diisi.'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 255 }).withMessage('Deskripsi maksimal 255 karakter.'),
  body('occurred_at').optional({ values: 'null' }).isISO8601().withMessage('Waktu transaksi harus berformat ISO 8601.'),
], financeController.createTransaction);

module.exports = router;
