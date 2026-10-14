require('dotenv').config();

module.exports = {
  appName: process.env.APP_NAME || 'Backend API',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'backend',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change_this_secret_before_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  passwordReset: {
    expiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 15),
    frontendUrl:
      process.env.FRONTEND_RESET_PASSWORD_URL ||
      'http://localhost:3000/reset-password',
  },
};
