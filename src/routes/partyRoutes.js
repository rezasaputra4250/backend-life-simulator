const express = require('express');
const { body, param } = require('express-validator');
const partyController = require('../controllers/partyController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', partyController.list);
router.post(
  '/',
  [
    body('name').isString().trim().isLength({ min: 1, max: 120 }).withMessage('Nama party wajib diisi.'),
    body('max_members').optional().isInt({ min: 2, max: 20 }).withMessage('Jumlah anggota party harus antara 2 sampai 20.'),
  ],
  partyController.create
);
router.post(
  '/:id/members',
  [
    param('id').isInt({ min: 1 }).withMessage('ID party tidak valid.'),
    body('user_id').isInt({ min: 1 }).withMessage('ID pengguna tidak valid.'),
  ],
  partyController.addMember
);
router.delete(
  '/:id/members/:userId',
  [
    param('id').isInt({ min: 1 }).withMessage('ID party tidak valid.'),
    param('userId').isInt({ min: 1 }).withMessage('ID pengguna tidak valid.'),
  ],
  partyController.removeMember
);

module.exports = router;
