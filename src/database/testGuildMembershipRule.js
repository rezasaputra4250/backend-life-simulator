require('dotenv').config();

const { faker } = require('@faker-js/faker');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const USER_COUNT = 100;
const shouldCommit = process.argv.includes('--commit');

async function testGuildMembershipRule() {
  const connection = await pool.getConnection();
  const passwordHash = await bcrypt.hash('TestGuild123!', 4);
  let rejectedSecondMemberships = 0;

  faker.seed(20261017);

  try {
    await connection.beginTransaction();

    for (let index = 0; index < USER_COUNT; index += 1) {
      const name = faker.person.fullName();
      const email = `guild-rule-${Date.now()}-${index}-${faker.string.alphanumeric(6).toLowerCase()}@example.test`;
      const affiliateCode = `TEST${Date.now()}${index}`.slice(0, 32);
      const [userResult] = await connection.query(
        `INSERT INTO users (name, email, password, affiliate_code, difficulty)
         VALUES (?, ?, ?, ?, 'easy')`,
        [name, email, passwordHash, affiliateCode]
      );
      const userId = userResult.insertId;

      const [guildResult] = await connection.query(
        `INSERT INTO guilds (owner_id, name, description, max_members)
         VALUES (?, ?, ?, 20)`,
        [userId, `${name} Guild`, 'Guild pengujian aturan satu user satu guild.']
      );
      await connection.query(
        "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'owner')",
        [guildResult.insertId, userId]
      );

      await connection.query(`SAVEPOINT second_guild_attempt_${index}`);
      const [secondGuild] = await connection.query(
        `INSERT INTO guilds (owner_id, name, description, max_members)
         VALUES (?, ?, ?, 20)`,
        [userId, `${name} Guild Kedua`, 'Guild kedua untuk pengujian penolakan.']
      );
      try {
        await connection.query(
          "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'owner')",
          [secondGuild.insertId, userId]
        );
        throw new Error(`Aturan gagal: user ${userId} dapat memiliki guild kedua.`);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        rejectedSecondMemberships += 1;
        await connection.query(`ROLLBACK TO SAVEPOINT second_guild_attempt_${index}`);
      }
    }

    if (rejectedSecondMemberships !== USER_COUNT) {
      throw new Error(`Ekspektasi ${USER_COUNT} penolakan, tetapi hanya ${rejectedSecondMemberships}.`);
    }

    if (shouldCommit) {
      await connection.commit();
    } else {
      await connection.rollback();
    }

    console.log(`Tester aturan guild lulus: ${USER_COUNT} user Faker dibuat, ${rejectedSecondMemberships} guild kedua ditolak.`);
    console.log(shouldCommit ? 'Data tester disimpan karena memakai --commit.' : 'Transaksi di-rollback; database tidak menyimpan data tester.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

testGuildMembershipRule().catch((error) => {
  console.error('Tester aturan guild gagal:', error.message);
  process.exitCode = 1;
});
