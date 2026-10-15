const express = require('express');
const { param } = require('express-validator');
const missionController = require('../controllers/missionController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', missionController.list);
router.patch(
  '/:id/toggle',
  [param('id').isInt({ min: 1 }).withMessage('ID misi tidak valid.')],
  missionController.toggle
);

module.exports = router;
