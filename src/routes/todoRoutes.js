const express = require('express');
const { body, param } = require('express-validator');
const todoController = require('../controllers/todoController');
const { authenticate } = require('../middleware/authMiddleware');

const dueDateValidator = (value) => {
  if (value === null || value === undefined || value === '') return true;

  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(String(value));
};

const router = express.Router();

router.use(authenticate);
router.get('/', todoController.list);
router.post(
  '/',
  [
    body('title').isString().trim().isLength({ min: 1, max: 180 }).withMessage('Judul to-do wajib diisi dan maksimal 180 karakter.'),
    body('description').optional({ nullable: true }).isString().withMessage('Deskripsi to-do harus berupa teks.'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Prioritas to-do tidak valid.'),
    body('due_date').optional({ nullable: true }).custom(dueDateValidator).withMessage('Waktu pelaksanaan harus berformat YYYY-MM-DD HH:mm atau YYYY-MM-DD HH:mm:ss.'),
  ],
  todoController.create
);
router.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID to-do tidak valid.'),
    body('title').optional().isString().trim().isLength({ min: 1, max: 180 }).withMessage('Judul to-do maksimal 180 karakter.'),
    body('description').optional({ nullable: true }).isString().withMessage('Deskripsi to-do harus berupa teks.'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']).withMessage('Status to-do tidak valid.'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Prioritas to-do tidak valid.'),
    body('due_date').optional({ nullable: true }).custom(dueDateValidator).withMessage('Waktu pelaksanaan harus berformat YYYY-MM-DD HH:mm atau YYYY-MM-DD HH:mm:ss.'),
  ],
  todoController.update
);
router.delete('/:id', [param('id').isInt({ min: 1 }).withMessage('ID to-do tidak valid.')], todoController.remove);

module.exports = router;
