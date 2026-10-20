const express = require('express');
const { body, param } = require('express-validator');
const authRoutes = require('./authRoutes');
const missionRoutes = require('./missionRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const friendRoutes = require('./friendRoutes');
const partyRoutes = require('./partyRoutes');
const guildRoutes = require('./guildRoutes');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const authController = require('../controllers/authController');
const rpgController = require('../controllers/rpgController');
const customMissionController = require('../controllers/customMissionController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.use('/auth', authRoutes);
router.get('/me', authenticate, authController.me);
router.patch('/me/profile', authenticate, [
  body('name').optional().isString().trim().isLength({ min: 2, max: 160 }).withMessage('Nama minimal 2 karakter.'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Format email tidak valid.'),
  body('employee_number').optional({ nullable: true }).isString().trim().isLength({ max: 80 }).withMessage('Nomor karyawan maksimal 80 karakter.'),
  body('position').optional({ nullable: true }).isString().trim().isLength({ max: 120 }).withMessage('Posisi maksimal 120 karakter.'),
  body('department').optional({ nullable: true }).isString().trim().isLength({ max: 120 }).withMessage('Departemen maksimal 120 karakter.'),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }).withMessage('Nomor telepon maksimal 40 karakter.'),
  body('religion').optional({ nullable: true }).isIn(['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu', 'lainnya', 'tidak_menjawab']).withMessage('Preferensi agama tidak valid.'),
  body('bio').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }).withMessage('Bio maksimal 2000 karakter.'),
], authController.updateProfile);
router.patch('/me/password', authenticate, [
  body('current_password').isString().notEmpty().withMessage('Password saat ini wajib diisi.'),
  body('new_password').isString().isLength({ min: 8 }).withMessage('Password baru minimal 8 karakter.'),
  body('confirm_password').isString().custom((value, { req }) => value === req.body.new_password).withMessage('Konfirmasi password tidak sama.'),
], authController.changePassword);
router.use('/missions', missionRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/friends', friendRoutes);
router.use('/parties', partyRoutes);
router.use('/guilds', guildRoutes);

router.get('/classes', authenticate, rpgController.classes);
router.post('/me/class', authenticate, [body('class_id').isInt({ min: 1 }).withMessage('Class tidak valid.')], rpgController.selectClass);
router.get('/me/progression', authenticate, rpgController.progression);
router.get('/difficulty-configs', authenticate, rpgController.difficultyConfigs);
router.patch('/me/difficulty', authenticate, [body('difficulty').isIn(['easy', 'normal', 'hard', 'expert']).withMessage('Difficulty tidak valid.')], rpgController.updateDifficulty);
router.get('/me/experience-history', authenticate, rpgController.experienceHistory);
router.get('/leaderboards', authenticate, rpgController.leaderboard);
router.get('/mission-templates', authenticate, customMissionController.templates);
router.post('/missions/custom', authenticate, [
  body('title').isString().trim().isLength({ min: 2, max: 180 }).withMessage('Judul misi harus antara 2 sampai 180 karakter.'),
  body('detail').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Detail misi maksimal 255 karakter.'),
  body('category').optional().isIn(['personal']).withMessage('Kategori misi personal tidak valid.'),
  body('difficulty').optional().isIn(['easy', 'normal', 'hard', 'expert']).withMessage('Tingkat kesulitan tidak valid.'),
  body('duration_minutes').optional().isInt({ min: 1, max: 480 }).withMessage('Durasi misi harus antara 1 sampai 480 menit.'),
  body('reward_xp').optional().isInt({ min: 1, max: 500 }).withMessage('Reward XP harus antara 1 sampai 500.'),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Frekuensi misi tidak valid.'),
  body('mission_date').optional().isISO8601({ strict: true }).withMessage('Tanggal pelaksanaan misi tidak valid.'),
  body('scheduled_time').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Waktu pelaksanaan misi tidak valid.'),
], customMissionController.create);
router.post('/missions/:id/complete', authenticate, [param('id').isInt({ min: 1 }).withMessage('ID misi tidak valid.')], customMissionController.complete);

router.get('/notifications', authenticate, notificationController.list);
router.patch('/notifications/read-all', authenticate, notificationController.readAll);
router.patch('/notifications/:id/read', authenticate, [param('id').isInt({ min: 1 }).withMessage('ID notifikasi tidak valid.')], notificationController.read);

router.use('/admin', authenticate, requireAdmin);
router.get('/admin/classes', adminController.classes);
router.post('/admin/mission-templates', [
  body('title').isString().trim().isLength({ min: 2, max: 180 }).withMessage('Judul template wajib diisi.'),
  body('difficulty').optional().isIn(['easy', 'normal', 'hard', 'expert']).withMessage('Tingkat kesulitan tidak valid.'),
  body('reward_xp').optional().isInt({ min: 1, max: 1000 }).withMessage('Reward XP tidak valid.'),
], adminController.createTemplate);
router.patch('/admin/mission-templates/:id/toggle', [param('id').isInt({ min: 1 }).withMessage('ID template tidak valid.')], adminController.toggleTemplate);

module.exports = router;
