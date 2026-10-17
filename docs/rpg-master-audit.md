# RPG Life Master Prompt Audit

Dokumen ini mencatat status implementasi backend terhadap master prompt. Audit dilakukan bertahap agar endpoint mobile existing tetap kompatibel.

## Backend sudah diterapkan

- Difficulty user memakai `easy`, `normal`, `hard`, dan `expert` dengan default `easy`.
- Nilai legacy `medium` dan `epic` dimigrasikan saat migration berjalan.
- Difficulty configuration tersedia dengan reward awal `100`, `50`, `10`, dan `5` XP.
- Difficulty dan reward mission disimpan sebagai snapshot saat mission dibuat.
- Player EXP memakai service progression dengan rumus pertumbuhan `1.5` dan dukungan multi-level.
- `user_stats.experience` tetap menjadi total EXP kumulatif.
- EXP ledger memakai idempotency key dan transaksi database.
- Pemberian EXP mengunci `user_stats` dengan `FOR UPDATE`.
- Koreksi EXP dicatat sebagai transaksi negatif.
- Reward mission dipusatkan pada `rewardService`.
- Reward Guild contribution juga memakai `rewardService`; EXP hanya diberikan jika flag eksplisit aktif.
- Guild contribution tidak memberikan Player EXP kecuali `grant_player_experience` diaktifkan eksplisit.
- Timestamp dan `deleted_at` ditambahkan secara idempotent ke tabel yang dikelola migration.
- Query aktif pada jalur RPG utama memfilter `deleted_at IS NULL`.
- Endpoint existing `/missions`, `/guilds`, `/me`, dan progression tetap dipertahankan.

## Tahap backend berikutnya

- Menyelesaikan dual-write transaction untuk System Mission refresh dan seluruh jalur legacy write yang masih tersisa.
- Menambah integration test runtime untuk migration idempotency, concurrent completion, soft delete, dan explicit guild EXP.

## Domain tables

- `system_mission_instances` menyimpan instance System Mission per user.
- `personal_missions` menyimpan Personal Mission per user.
- `guild_missions` menyimpan Guild Mission dan memiliki `legacy_mission_id` untuk projection kompatibilitas.
- `missions` masih dipertahankan sebagai projection legacy selama endpoint existing dimigrasikan secara bertahap.
- Read path mission aktif sudah memakai domain table dan mempertahankan `legacy_mission_id` sebagai ID API kompatibilitas.
- Read path memiliki fallback eksplisit ke projection legacy jika domain mapping belum tersedia.
- Create System, Personal, dan Guild Mission memakai domain table sebagai sumber write lalu membuat projection kompatibilitas dalam transaksi.
- Regression test tersedia untuk progresi level, reward XP/non-XP, idempotency, dan guild EXP eksplisit/non-eksplisit.

## Catatan balancing

Difficulty lebih tinggi memiliki reward dasar lebih kecil sesuai aturan produk: Easy `100`, Normal `50`, Hard `10`, Expert `5`. Reward tersebut adalah baseline konfigurasi; mission dapat menyimpan nilai reward snapshot tersendiri. Perubahan difficulty user tidak mengubah mission yang sudah dibuat.

## Validasi environment

Regression test backend lulus 8/8 menggunakan Node.js absolut dari `C:\\Program Files\\nodejs`.
Expo lint dan TypeScript check mobile lulus.
Migration berhasil dijalankan dua kali berturut-turut pada database development lokal tanpa error.
