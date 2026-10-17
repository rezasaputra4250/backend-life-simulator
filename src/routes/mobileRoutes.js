const express = require('express');
const authRoutes = require('./authRoutes');
const missionRoutes = require('./missionRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const affiliateRoutes = require('./affiliateRoutes');
const friendRoutes = require('./friendRoutes');
const partyRoutes = require('./partyRoutes');
const guildRoutes = require('./guildRoutes');

const router = express.Router();

// Mobile is a channel boundary; each child route remains an independent feature module.
router.use('/auth', authRoutes);
router.use('/missions', missionRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/friends', friendRoutes);
router.use('/parties', partyRoutes);
router.use('/guilds', guildRoutes);

module.exports = router;
