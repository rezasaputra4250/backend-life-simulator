require('dotenv').config();

const pool = require('../config/database');

const kingdomGuilds = [
  ['Kerajaan Majapahit', 'Guild persatuan dan perdagangan yang terinspirasi dari kejayaan Majapahit.', 50],
  ['Kerajaan Sriwijaya', 'Guild pelaut, pembelajar, dan penjaga jalur perdagangan Nusantara.', 50],
  ['Kesultanan Mataram', 'Guild agraris yang menjunjung ketekunan, tata kelola, dan gotong royong.', 40],
  ['Kerajaan Samudera Pasai', 'Guild pelopor perdagangan dan ilmu pengetahuan di pesisir Sumatra.', 40],
  ['Kerajaan Kutai Martadipura', 'Guild tua yang menjaga tradisi, ketahanan, dan kebijaksanaan leluhur.', 30],
  ['Kerajaan Tarumanegara', 'Guild pembangun yang mengutamakan karya, infrastruktur, dan kepemimpinan.', 30],
  ['Kerajaan Singhasari', 'Guild para penjelajah yang berani memperluas wawasan dan pergaulan.', 40],
  ['Kesultanan Demak', 'Guild maritim yang menggabungkan perdagangan, komunitas, dan nilai kebersamaan.', 40],
  ['Kesultanan Ternate', 'Guild kepulauan yang kuat dalam perdagangan, diplomasi, dan ketahanan.', 30],
  ['Kesultanan Tidore', 'Guild pelaut dan penjaga kepulauan dengan semangat mandiri.', 30],
];

async function seedKingdomGuilds() {
  const ownerId = Number(process.env.SEED_GUILD_OWNER_ID || 0);
  const [owners] = ownerId
    ? await pool.query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [ownerId])
    : await pool.query('SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id ASC');

  if (!owners.length) {
    throw new Error('Tidak ada pengguna aktif untuk menjadi pemilik guild seed.');
  }

  const connection = await pool.getConnection();
  let created = 0;
  let skipped = 0;
  try {
    await connection.beginTransaction();
    for (let index = 0; index < kingdomGuilds.length; index += 1) {
      const [name, description, maxMembers] = kingdomGuilds[index];
      const [existing] = await connection.query(
        'SELECT id FROM guilds WHERE name = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [name]
      );
      if (existing.length) {
        skipped += 1;
        continue;
      }

      const [availableOwners] = await connection.query(
        `SELECT users.id
         FROM users
         WHERE users.deleted_at IS NULL
           AND (? = 0 OR users.id = ?)
           AND NOT EXISTS (
             SELECT 1 FROM guild_members
             WHERE guild_members.user_id = users.id AND guild_members.deleted_at IS NULL
           )
         ORDER BY users.id ASC
         LIMIT 1`,
        [ownerId, ownerId]
      );
      if (!availableOwners.length) {
        skipped += 1;
        continue;
      }

      const selectedOwnerId = availableOwners[0].id;
      const [result] = await connection.query(
        'INSERT INTO guilds (owner_id, name, description, max_members) VALUES (?, ?, ?, ?)',
        [selectedOwnerId, name, description, maxMembers]
      );
      await connection.query(
        "INSERT INTO guild_members (guild_id, user_id, role) VALUES (?, ?, 'owner')",
        [result.insertId, selectedOwnerId]
      );
      created += 1;
    }
    await connection.commit();
    console.log(`Seeder guild kerajaan selesai. ${created} guild dibuat, ${skipped} dilewati karena nama sudah ada atau pemilik tersedia tidak cukup.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = seedKingdomGuilds;

if (require.main === module) {
  seedKingdomGuilds()
    .catch((error) => {
      console.error('Seeder guild kerajaan gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
