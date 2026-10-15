const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const missionRoutes = require('./routes/missionRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

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

app.use('/api/auth', authRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/inventory', inventoryRoutes);

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
