require('dotenv').config();

const { faker } = require('@faker-js/faker');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const USER_COUNT = 100;
const shouldCommit = process.argv.includes('--commit');
const KINGDOM_NAMES = [
  'Kerajaan Majapahit',
  'Kerajaan Sriwijaya',
  'Kesultanan Mataram',
  'Kerajaan Samudera Pasai',
  'Kerajaan Kutai Martadipura',
  'Kerajaan Tarumanegara',
  'Kerajaan Singhasari',
  'Kesultanan Demak',
  'Kesultanan Ternate',
  'Kesultanan Tidore',
];

async function testGuildMembershipRule() {
  const connection = await pool.getConnection();
  const passwordHash = await bcrypt.hash('TestGuild123!', 4);
  let rejectedSecondMemberships = 0;
  const testUsers = [];

  faker.seed(20261017);

  try {
    await connection.beginTransaction();

    const runId = Date.now();
    for (let index = 0; index < USER_COUNT; index += 1) {
      const name = faker.person.fullName();
      const email = `guild-rule-${runId}-${index}-${faker.string.alphanumeric(6).toLowerCase()}@example.test`;
      const affiliateCode = `TEST${runId}${index}`.slice(0, 32);
      const [userResult] = await connection.query(
        `INSERT INTO users (name, email, password, affiliate_code, difficulty)
         VALUES (?, ?, ?, ?, 'easy')`,
        [name, email, passwordHash, affiliateCode]
      );
      testUsers.push({ id: userResult.insertId, name });
    }

    const [existingGuilds] = await connection.query(
      `SELECT id, name
       FROM guilds
       WHERE deleted_at IS NULL AND name IN (?)
       ORDER BY id ASC`,
      [KINGDOM_NAMES]
    );
    const guildsByName = new Map(existingGuilds.map((guild) => [guild.name, guild]));
    let ownerCursor = 0;
    for (const name of KINGDOM_NAMES) {
      if (guildsByName.has(name)) continue;
      const owner = testUsers[ownerCursor];
      ownerCursor += 1;
      const [guildResult] = await connection.query(
        `INSERT INTO guilds (owner_id, name, description, max_members)
         VALUES (?, ?, ?, 20)`,
        [owner.id, name, `Guild pengujian untuk ${name}.`]
      );
      await connection.query(
        "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'owner')",
        [guildResult.insertId, owner.id]
      );
      guildsByName.set(name, { id: guildResult.insertId, name });
    }

    const kingdomGuilds = KINGDOM_NAMES.map((name) => guildsByName.get(name));
    for (let index = 0; index < testUsers.length; index += 1) {
      const user = testUsers[index];
      const [currentMembership] = await connection.query(
        'SELECT guild_id FROM guild_members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
        [user.id]
      );
      const firstGuild = currentMembership.length
        ? currentMembership[0].guild_id
        : kingdomGuilds[index % kingdomGuilds.length].id;
      if (!currentMembership.length) {
        await connection.query(
          "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'member')",
          [firstGuild, user.id]
        );
      }

      const secondGuild = kingdomGuilds.find((guild) => Number(guild.id) !== Number(firstGuild));
      await connection.query(`SAVEPOINT second_guild_attempt_${index}`);
      try {
        await connection.query(
          "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'member')",
          [secondGuild.id, user.id]
        );
        throw new Error(`Aturan gagal: user ${user.id} dapat memiliki guild kedua.`);
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

    console.log(`Tester aturan guild lulus: ${USER_COUNT} user Faker diuji pada ${KINGDOM_NAMES.length} guild kerajaan, ${rejectedSecondMemberships} guild kedua ditolak.`);
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
