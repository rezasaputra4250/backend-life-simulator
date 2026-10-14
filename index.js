const app = require('./src/app');
const env = require('./src/config/env');

app.listen(env.port, () => {
  console.log(`${env.appName} berjalan di port ${env.port}`);
});
