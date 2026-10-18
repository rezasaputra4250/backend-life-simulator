# Perlindungan Deployment Server

Repo ini tidak boleh membuat server staging atau production update sendiri hanya karena branch `staging` atau `main` berubah.

## Aturan utama

1. Jangan buat workflow deploy dengan trigger `push` ke `staging` atau `main`.
2. Deploy harus memakai `workflow_dispatch` atau proses manual yang disetujui.
3. Deploy ke staging hanya boleh memakai ref `staging`.
4. Deploy ke production hanya boleh memakai ref `main`.
5. Environment GitHub `staging` dan `production` wajib punya required reviewer `@rezasaputra4250`.
6. Server tidak boleh memasang webhook auto-pull dari GitHub.
7. Server tidak boleh menjalankan cron `git pull` otomatis untuk branch `staging` atau `main`.

## Setting GitHub Environment

Buka `Settings` -> `Environments`, lalu buat:

- `staging`
- `production`

Untuk masing-masing environment:

1. Aktifkan `Required reviewers`.
2. Masukkan `@rezasaputra4250`.
3. Jika tersedia, aktifkan batasan branch:
   - Environment `staging` hanya boleh dari branch `staging`.
   - Environment `production` hanya boleh dari branch `main`.

## Workflow manual

File `.github/workflows/manual-deploy.yml` disediakan sebagai guard. Workflow ini:

- Tidak berjalan saat push.
- Hanya bisa dijalankan manual.
- Memakai GitHub Environment agar bisa menunggu approval.
- Belum menjalankan SSH/rsync/deploy sungguhan.

Jika nanti ingin deploy otomatis setelah approval, tambahkan langkah deploy di workflow tersebut, bukan di workflow yang berjalan saat push.

## Cek di server

Pastikan tidak ada mekanisme auto-update seperti:

- GitHub webhook yang menjalankan `git pull`.
- Cron job yang menjalankan `git pull`.
- Panel hosting yang auto-deploy dari branch `main` atau `staging`.
- Service seperti Ploi, Forge, RunCloud, cPanel Git Deployment, atau DeployHQ yang auto-deploy saat push.

Jika ada, matikan auto-deploy dan ubah menjadi manual deploy dengan approval.
