const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { roleNames } = require('../constants/roles');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
    body('email').isEmail().withMessage('Email tidak valid.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter.'),
    body('role')
      .optional()
      .isIn(roleNames)
      .withMessage('Role tidak valid.'),
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email tidak valid.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password wajib diisi.'),
  ],
  authController.login
);

router.get('/me', authenticate, authController.me);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Email tidak valid.').normalizeEmail()],
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Email tidak valid.').normalizeEmail(),
    body('token').notEmpty().withMessage('Token wajib diisi.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter.'),
  ],
  authController.resetPassword
);

module.exports = router;
