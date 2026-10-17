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
    body('birth_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('Tanggal lahir tidak valid.'),
    body('gender')
      .optional({ nullable: true })
      .isIn(['male', 'female', 'other'])
      .withMessage('Jenis kelamin tidak valid.'),
    body('phone')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 40 })
      .withMessage('Nomor telepon terlalu panjang.'),
    body('address')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage('Alamat terlalu panjang.'),
    body('role')
      .optional()
      .isIn(roleNames)
      .withMessage('Role tidak valid.'),
    body('company_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Perusahaan tidak valid.'),
    body('referral_code')
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 6, max: 32 })
      .matches(/^[A-Z0-9]+$/i)
      .withMessage('Kode referral tidak valid.'),
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
