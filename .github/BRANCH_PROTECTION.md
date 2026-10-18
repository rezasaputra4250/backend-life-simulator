# Branch Protection

Workflow di repo ini membantu memeriksa proses `feature/*` → `local` → `develop` → `staging` → `main/master`, tetapi GitHub tetap perlu dikonfigurasi agar pembatasan orang dan approval benar-benar aktif.

## Alur branch

1. Developer membuat branch kerja dari `local`, misalnya `feature/nama-fitur`, `bugfix/nama-bug`, `hotfix/nama-fix`, `fix/nama-fix`, `chore/nama-task`, atau `release/nama-release`.
2. Perubahan ke `local` harus lewat Pull Request dari branch kerja tersebut.
3. Perubahan ke `develop` harus lewat Pull Request dari `local`.
4. Perubahan ke `staging` harus lewat Pull Request dari `develop`.
5. Perubahan ke `main` atau `master` harus lewat Pull Request dari `staging`.
6. Pull Request ke semua branch tersebut menjalankan `Validasi aturan Pull Request`, `Validasi file sensitif`, `Pemeriksaan Node.js backend`, `Audit dependency`, `Scan keamanan Semgrep`, `Scan secret dengan Gitleaks`, dan `Analisis keamanan CodeQL`.
7. Workflow memvalidasi alur Pull Request. Blokir push langsung harus diaktifkan melalui GitHub Ruleset/Branch Protection.

## Ruleset untuk `main`, `master`, dan `staging`

File import siap pakai tersedia di `.github/rulesets/branch-protection.json`.

1. Buka `Settings` -> `Rules` -> `Rulesets` atau `Settings` -> `Branches`.
2. Pilih `Import a ruleset` dan unggah `.github/rulesets/branch-protection.json`.
3. Pastikan target branch mencakup `local`, `develop`, `staging`, `main`, dan `master`.
4. Pastikan `Enforcement status` bernilai `Active`.
5. Periksa status check dan review yang sudah terisi dari file JSON.

## Ruleset untuk `develop`

1. `develop` hanya boleh menerima Pull Request dari `local`.
2. Aktifkan `Require a pull request before merging`.
3. Aktifkan `Require status checks to pass`.
4. Pilih status check `Validasi aturan Pull Request`.
5. Pilih status check `Validasi file sensitif`.
6. Pilih status check `Pemeriksaan Node.js backend`.
7. Pilih status check `Audit dependency`.
8. Pilih status check `Scan keamanan Semgrep`.
9. Pilih status check `Scan secret dengan Gitleaks`.
10. Pilih status check `Analisis keamanan CodeQL`.
11. Aktifkan `Block force pushes`.
12. Aktifkan `Restrict deletions`.

## Ruleset untuk `local`

Ruleset import yang sama juga melindungi `local` dan memastikan perubahan masuk melalui Pull Request dari branch kerja.

1. `local` hanya boleh menerima Pull Request dari branch kerja seperti `feature/*`, `bugfix/*`, `hotfix/*`, `fix/*`, `chore/*`, atau `release/*`.
2. Aktifkan `Require a pull request before merging`.
3. Aktifkan `Require status checks to pass`.
4. Pilih status check `Validasi aturan Pull Request`.
5. Pilih status check `Validasi file sensitif`.
6. Pilih status check `Pemeriksaan Node.js backend`.
7. Pilih status check `Audit dependency`.
8. Pilih status check `Scan keamanan Semgrep`.
9. Pilih status check `Scan secret dengan Gitleaks`.
10. Pilih status check `Analisis keamanan CodeQL`.
11. Tetap aktifkan `Block force pushes` dan `Restrict deletions` jika branch ini dipakai bersama.

## Dependabot

File `.github/dependabot.yml` akan membuat Pull Request otomatis ke branch `local` untuk update NPM dan GitHub Actions.

## Deployment server

Branch `staging` dan `main` tidak boleh membuat server update sendiri saat ada push atau merge.

Gunakan panduan `.github/DEPLOYMENT_PROTECTION.md` dan workflow `.github/workflows/manual-deploy.yml`.

Intinya:

1. Jangan pakai trigger deploy `push` untuk `staging` atau `main`.
2. Deploy hanya boleh manual lewat `workflow_dispatch`.
3. Environment `staging` dan `production` wajib approval dari `@rezasaputra4250`.
4. Matikan webhook, cron, atau panel hosting yang auto-pull dari `staging` atau `main`.

Dengan pengaturan ini, branch kerja seperti `feature/*` dan `bugfix/*` tetap fleksibel untuk developer, sedangkan `local`, `develop`, `staging`, `main`, dan `master` hanya bisa diubah lewat Pull Request yang sudah disetujui oleh `@rezasaputra4250` dan lolos semua check.
