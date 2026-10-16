const express = require('express');
const { body, param } = require('express-validator');
const friendController = require('../controllers/friendController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', friendController.list);
router.get('/search', friendController.search);
router.post(
  '/requests',
  [body('user_id').isInt({ min: 1 }).withMessage('ID pengguna tidak valid.')],
  friendController.request
);
router.patch(
  '/requests/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID permintaan tidak valid.'),
    body('action').isIn(['accept', 'reject']).withMessage('Aksi pertemanan tidak valid.'),
  ],
  friendController.respond
);
router.delete(
  '/:userId',
  [param('userId').isInt({ min: 1 }).withMessage('ID pengguna tidak valid.')],
  friendController.remove
);

module.exports = router;
