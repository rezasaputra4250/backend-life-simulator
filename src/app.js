const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mobileRoutes = require('./routes/mobileRoutes');
const authRoutes = require('./routes/authRoutes');
const missionRoutes = require('./routes/missionRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const affiliateRoutes = require('./routes/affiliateRoutes');
const friendRoutes = require('./routes/friendRoutes');
const partyRoutes = require('./routes/partyRoutes');
const guildRoutes = require('./routes/guildRoutes');
const v1Routes = require('./routes/v1Routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    message: 'API backend berjalan.',
  });
});

// Current API channel: mobile. Feature modules are grouped behind this boundary.
app.use('/api/mobile', mobileRoutes);
app.use('/api/mobile/v1', v1Routes);

// Backward-compatible aliases for existing mobile app builds.
app.use('/api/auth', authRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/guilds', guildRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint tidak ditemukan.',
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

module.exports = app;
