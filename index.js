const app = require('./src/app');
const env = require('./src/config/env');
const os = require('os');

function getLanUrls() {
  return Object.values(os.networkInterfaces())
    .flatMap((interfaces) => interfaces || [])
    .filter((network) => network.family === 'IPv4' && !network.internal)
    .map((network) => `http://${network.address}:${env.port}`);
}

app.listen(env.port, env.host, () => {
  const lanUrls = getLanUrls();
  console.log(`${env.appName} berjalan di ${env.host}:${env.port}`);
  lanUrls.forEach((url) => console.log(`API LAN: ${url}/api/mobile`));
});
