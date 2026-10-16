const express = require('express');
const affiliateController = require('../controllers/affiliateController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', affiliateController.profile);

module.exports = router;
