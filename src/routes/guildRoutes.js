const express = require('express');
const { body, param } = require('express-validator');
const guildController = require('../controllers/guildController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', guildController.list);
router.post(
  '/',
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Nama guild harus antara 2 sampai 120 karakter.'),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Deskripsi guild maksimal 255 karakter.'),
    body('max_members').optional().isInt({ min: 2, max: 100 }).withMessage('Jumlah anggota guild harus antara 2 sampai 100.'),
  ],
  guildController.create
);
router.post(
  '/:id/missions',
  [
    param('id').isInt({ min: 1 }).withMessage('ID guild tidak valid.'),
    body('title').isString().trim().isLength({ min: 2, max: 180 }).withMessage('Judul misi guild harus antara 2 sampai 180 karakter.'),
    body('detail').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Detail misi guild maksimal 255 karakter.'),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard', 'epic']).withMessage('Tingkat kesulitan misi guild tidak valid.'),
    body('reward_xp').optional().isInt({ min: 1, max: 500 }).withMessage('Reward XP misi guild harus antara 1 sampai 500.'),
    body('target_progress').optional().isInt({ min: 1, max: 1000 }).withMessage('Target progress harus antara 1 sampai 1000.'),
    body('mission_date').isISO8601({ strict: true }).withMessage('Tanggal misi guild tidak valid.'),
    body('scheduled_time').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Waktu misi guild tidak valid.'),
  ],
  guildController.createMission
);
router.post(
  '/:guildId/missions/:missionId/contribute',
  [
    param('guildId').isInt({ min: 1 }).withMessage('ID guild tidak valid.'),
    param('missionId').isInt({ min: 1 }).withMessage('ID misi guild tidak valid.'),
    body('amount').optional().isInt({ min: 1, max: 100 }).withMessage('Jumlah kontribusi harus antara 1 sampai 100.'),
  ],
  guildController.contributeMission
);
router.patch(
  '/invitations/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID undangan guild tidak valid.'),
    body('action').isIn(['accept', 'reject']).withMessage('Aksi undangan guild tidak valid.'),
  ],
  guildController.respond
);
router.post(
  '/:id/invitations',
  [
    param('id').isInt({ min: 1 }).withMessage('ID guild tidak valid.'),
    body('user_id').isInt({ min: 1 }).withMessage('ID pengguna tidak valid.'),
  ],
  guildController.invite
);

module.exports = router;
