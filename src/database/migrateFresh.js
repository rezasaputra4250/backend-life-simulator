require('dotenv').config();

const mysql = require('mysql2/promise');
const env = require('../config/env');
const migrate = require('./migrate');

async function migrateFresh() {
  if (env.nodeEnv === 'production' && !process.argv.includes('--force')) {
    throw new Error('migrate:fresh diblokir pada production. Gunakan --force jika benar-benar diperlukan.');
  }

  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    multipleStatements: true,
  });
  const databaseName = env.database.name.replace(/`/g, '``');

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    console.log(`Database ${env.database.name} dihapus.`);
  } finally {
    await connection.end();
  }

  await migrate();
  console.log('migrate:fresh selesai. Schema dibuat ulang dari awal.');
}

migrateFresh().catch((error) => {
  console.error('migrate:fresh gagal:', error.message);
  process.exit(1);
});
