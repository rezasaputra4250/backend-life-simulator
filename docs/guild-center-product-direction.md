# Arah Produk: Guild Center

Dokumen ini mencatat arah pengembangan aplikasi ke depan. Dokumen ini menjadi acuan awal untuk desain domain, API, database, dan pengalaman pengguna pada backend dan mobile.

## Visi Produk

Aplikasi dikembangkan menjadi **Guild Center**: ruang sosial dan produktivitas bergaya RPG tempat setiap pengguna membangun karakter, menjalankan aktivitas sebagai solo player, dan berinteraksi dengan guild.

Karakter RPG bukan hanya profil kosmetik. Karakter menjadi representasi perkembangan pengguna melalui level, experience, skill, achievement, kontribusi, dan hubungan sosialnya di dalam aplikasi.

## Pilar Utama

### 1. Karakter RPG

Setiap user memiliki satu karakter utama yang dapat berkembang melalui aktivitas aplikasi.

Ruang pengembangan yang dipertahankan atau diperluas:

- level dan experience;
- skill dan reward;
- achievement dan statistik;
- inventory atau koleksi bila dibutuhkan pada fase berikutnya;
- profil karakter yang dapat ditampilkan kepada user lain dan anggota guild.

### 2. Solo Player

User tetap dapat menggunakan aplikasi secara mandiri tanpa harus bergabung dengan guild.

Mode solo mencakup:

- menjalankan system mission;
- menyelesaikan aktivitas untuk perkembangan karakter;
- mengelola skill dan reward pribadi;
- melihat progres, streak, dan statistik sendiri.

Keanggotaan guild tidak boleh menjadi prasyarat untuk mendapatkan pengalaman inti aplikasi.

### 3. Guild

Guild adalah kelompok sosial dengan identitas, anggota, peran, misi, kontribusi, dan progres bersama.

Fitur guild yang direncanakan:

- membuat dan mengelola profil guild;
- mengundang atau menerima anggota;
- role dan permission dalam guild;
- guild mission dan kontribusi anggota;
- progres atau level guild;
- aktivitas dan riwayat kontribusi yang dapat diaudit.

### 4. Leaderboard

Leaderboard menjadi lapisan kompetitif dan motivasi tambahan untuk karakter dan guild. Leaderboard tidak boleh menjadi satu-satunya ukuran nilai user; progres solo, kontribusi, dan pencapaian tetap perlu ditampilkan secara terpisah.

#### Player Leaderboard

Player leaderboard menampilkan peringkat individual berdasarkan metrik yang ditentukan, misalnya experience, mission completion, streak, atau skor kontribusi.

Tingkat kesulitan harus menjadi dimensi leaderboard player. User yang bermain pada tingkat kesulitan berbeda tidak langsung dibandingkan dalam papan yang sama.

Papan yang direncanakan:

- `easy`;
- `normal`;
- `hard`;
- `expert`.

Setiap papan perlu memiliki scope waktu agar peringkat dapat diikuti dan di-reset secara sehat, misalnya `daily`, `weekly`, `monthly`, dan `all_time`. Peringkat harus menyimpan snapshot atau sumber event yang dapat diaudit sehingga perubahan reward, koreksi EXP, atau penghapusan data tidak menghasilkan posisi yang tidak dapat dijelaskan.

#### Guild Leaderboard

Guild leaderboard menampilkan performa kolektif guild berdasarkan metrik seperti total kontribusi anggota, guild mission completion, activity score, atau progres guild.

Guild leaderboard sebaiknya memiliki filter periode dan region atau kategori bila skala produk membutuhkannya. Kontribusi satu user tidak boleh dihitung ganda ketika sudah masuk ke agregat guild.

#### Prinsip Fairness Leaderboard

- Player leaderboard hanya membandingkan data dalam difficulty dan periode yang sama.
- Metrik, formula score, dan tie-breaker harus terdokumentasi serta versioned.
- Reward leaderboard tidak boleh mengubah hasil mission atau EXP secara retroaktif.
- Aktivitas yang dibatalkan, curang, atau berasal dari akun yang terkena restriction tidak dihitung.
- Koreksi score harus meninggalkan audit trail.
- UI harus menampilkan posisi user sendiri walaupun user berada di luar peringkat teratas.

## Aturan Pembuatan Guild

Tidak semua user dapat langsung membuat guild. Pembuatan guild harus melalui eligibility rule dan, bila diperlukan, persetujuan.

Kandidat rule yang perlu didukung oleh desain sistem:

- minimum level atau experience karakter;
- minimum account age;
- tidak sedang terkena restriction atau suspension;
- batas jumlah guild yang dapat dibuat oleh satu user;
- biaya pembuatan atau resource tertentu jika balancing membutuhkannya;
- approval dari moderator atau admin untuk tahap awal.

Rule tersebut sebaiknya disimpan sebagai konfigurasi atau policy, bukan hardcode di controller. API perlu mengembalikan alasan yang jelas ketika user belum eligible.

Status guild yang disarankan:

- `pending` — menunggu approval;
- `active` — dapat menerima anggota dan menjalankan aktivitas;
- `suspended` — sementara dibatasi karena moderasi atau pelanggaran;
- `archived` — tidak aktif dan tidak menerima aktivitas baru.

## Perubahan Konsep Mission

Konsep **Personal Mission** dihilangkan sebagai kategori mission yang hanya melekat pada pembuatnya.

Sebagai gantinya, aplikasi menggunakan **Direct Mission**: misi yang dibuat oleh satu user untuk ditujukan kepada user lain secara spesifik.

### Direct Mission

Direct Mission memiliki minimal dua pihak:

- `issuer` — user yang membuat dan mengirim mission;
- `assignee` — user yang menerima dan bertanggung jawab menyelesaikan mission.

Aturan awal:

- issuer tidak boleh otomatis menjadi assignee untuk Direct Mission;
- assignee harus ditentukan secara eksplisit;
- assignee dapat menerima, menolak, membatalkan, atau menyelesaikan mission sesuai status;
- issuer dapat melihat status mission yang dikirim;
- perubahan status harus mencatat actor dan timestamp;
- reward dan konsekuensi harus tervalidasi oleh backend;
- Direct Mission tidak boleh muncul sebagai mission umum untuk semua user.

Nama domain dan endpoint baru sebaiknya menggunakan istilah `direct mission`. Field legacy seperti `personal_missions` atau `personal_mission_id` dipertahankan hanya selama masa migrasi kompatibilitas, lalu dihapus setelah seluruh consumer berpindah.

## Kategori Mission yang Diarahkan

Model mission ke depan dapat dikelompokkan sebagai berikut:

| Kategori | Target | Pembuat | Keterangan |
| --- | --- | --- | --- |
| System Mission | User yang memenuhi rule | System | Aktivitas umum dari sistem |
| Direct Mission | Satu user tertentu | User | Misi antar user dengan issuer dan assignee |
| Guild Mission | Anggota guild atau guild | Guild role yang berwenang | Aktivitas dengan kontribusi bersama |

Kategori harus menentukan visibility, permission, lifecycle, reward, dan audit trail. Jangan menyamakan Direct Mission dengan Guild Mission karena keduanya memiliki target dan otorisasi berbeda.

## Arah Domain dan Permission

Entitas inti yang perlu dipertimbangkan:

- `characters` atau perluasan dari profil/stat user;
- `guilds`;
- `guild_memberships`;
- `guild_roles` atau permission mapping;
- `guild_creation_requests`;
- `direct_missions`;
- `mission_events` atau audit trail status;
- `system_missions`;
- `guild_missions`.

Permission harus diperiksa di service layer, bukan hanya dari data yang dikirim client. Setiap operasi sensitif minimal memverifikasi identity, ownership atau membership, role, status entity, dan batasan lifecycle.

## Urutan Implementasi yang Disarankan

1. Finalisasi terminology dan aturan eligibility pembuatan guild.
2. Tambahkan domain character tanpa memutus endpoint profile dan progression yang sudah ada.
3. Bentuk guild membership, role, status, dan creation request.
4. Migrasikan Personal Mission menjadi Direct Mission dengan compatibility projection bila diperlukan.
5. Tambahkan visibility dan permission untuk System, Direct, dan Guild Mission.
6. Bangun UI Guild Center dan alur solo player di mobile.
7. Tambahkan moderation, audit, notification, dan balancing setelah lifecycle dasar stabil.

## Keputusan yang Masih Perlu Ditetapkan

- level, experience, atau syarat minimum untuk membuat guild;
- apakah approval moderator selalu wajib atau hanya untuk fase awal;
- jumlah maksimum guild yang dapat dibuat dan diikuti user;
- apakah guild memiliki resource, level, atau treasury sendiri;
- apakah Direct Mission membutuhkan persetujuan assignee sebelum aktif;
- apakah issuer dapat membatalkan mission setelah diterima;
- reward, batas waktu, dan aturan kegagalan Direct Mission;
- kebijakan privasi untuk pencarian user dan pengiriman mission;
- kebijakan moderasi untuk spam, harassment, dan guild yang tidak aktif;
- metrik utama dan formula score untuk player leaderboard;
- apakah leaderboard player memakai satu papan per difficulty atau juga memiliki papan gabungan;
- periode leaderboard dan aturan reset atau season;
- tie-breaker ketika dua player atau guild memiliki score yang sama;
- jenis reward, distribusi reward, dan batasan anti-farming;
- apakah guild leaderboard mengikuti difficulty tertentu atau memakai score guild tersendiri.
- apakah quest mendukung satu jawaban benar atau multiple correct answers;
- batas attempt, durasi, dan aturan retry untuk setiap difficulty;
- siapa yang dapat membuat, meninjau, dan menerbitkan quest;
- apakah quest competitive dapat digunakan dalam Direct Mission dan Guild Mission.

### 5. Quest Pilihan Ganda

Quest dapat berisi rangkaian soal pilihan ganda yang harus dijawab user untuk menyelesaikan objective tertentu. Quest menjadi bentuk aktivitas yang lebih terstruktur dibanding mission biasa dan dapat digunakan untuk pembelajaran, onboarding, event, atau tantangan guild.

Struktur dasar yang perlu didukung:

- quest memiliki judul, deskripsi, kategori, difficulty, status, dan batas waktu opsional;
- quest memiliki satu atau lebih question;
- setiap question memiliki prompt dan beberapa option;
- hanya satu option atau beberapa option dapat ditetapkan sebagai jawaban benar sesuai tipe soal;
- question dapat memiliki explanation yang ditampilkan setelah jawaban atau setelah quest selesai;
- urutan question dapat ditentukan dan dapat diacak melalui konfigurasi;
- quest dapat ditujukan untuk solo player, user tertentu melalui Direct Mission, atau anggota guild melalui Guild Mission.

#### Aturan Jawaban dan Attempt

- Jawaban dinilai oleh backend, bukan dipercaya dari score yang dikirim client.
- Setiap attempt menyimpan user, quest, jawaban, score, status, dan timestamp.
- Jumlah attempt dapat dibatasi per quest jika dibutuhkan untuk menjaga fairness.
- Quest dapat menggunakan mode practice tanpa leaderboard dan mode competitive yang berkontribusi pada score.
- Setelah submit, jawaban yang sudah dinilai tidak boleh diubah tanpa membuat event koreksi.
- Question dan answer key yang sudah dipakai pada attempt harus memiliki snapshot agar perubahan konten tidak mengubah histori.

#### Reward dan Difficulty

Difficulty quest mengikuti difficulty yang sudah digunakan aplikasi, yaitu `easy`, `normal`, `hard`, dan `expert`. Difficulty memengaruhi kompleksitas soal, waktu, jumlah attempt, atau reward sesuai konfigurasi produk.

Reward quest dapat berupa:

- experience untuk karakter;
- skill progress;
- achievement;
- guild contribution jika quest merupakan aktivitas guild;
- score leaderboard bila quest berada dalam mode competitive.

Reward harus diberikan secara idempotent. Submit ulang request yang sama tidak boleh menggandakan experience, contribution, atau reward lainnya.

#### Authoring dan Validasi Konten

Pembuatan quest dan question sebaiknya dibatasi berdasarkan role, misalnya system admin, moderator, atau guild role tertentu. Konten yang belum selesai ditinjau berada pada status draft dan tidak dapat dimainkan oleh user umum.

Status konten yang disarankan:

- `draft` — sedang dibuat atau diedit;
- `review` — menunggu pemeriksaan;
- `published` — dapat dimainkan sesuai visibility;
- `archived` — tidak menerima attempt baru.

Konten yang dipublikasikan perlu memiliki validasi minimal: jumlah option cukup, answer key valid, tidak ada question kosong, dan reward serta difficulty memiliki konfigurasi yang sah.

#### Relasi dengan Leaderboard

Quest competitive dapat menjadi sumber score player leaderboard atau guild leaderboard. Score perlu menyimpan referensi ke `quest_attempt`, difficulty, formula version, dan waktu penyelesaian. Quest practice tidak boleh memengaruhi leaderboard.

## Batasan Perubahan

Catatan ini belum mengubah runtime behavior, schema, atau endpoint. Setiap implementasi berikutnya harus dibuat sebagai perubahan terpisah dengan migration, compatibility plan, validasi permission, dan test untuk lifecycle yang terdampak.
