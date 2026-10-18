# Branch Protection

Workflow di repo ini membantu memeriksa proses dari `local`, `develop`, `staging`, sampai `main`, tetapi GitHub tetap perlu dikonfigurasi agar pembatasan orang dan approval benar-benar aktif.

## Alur branch

1. Developer membuat branch kerja dari `local`, misalnya `feature/nama-fitur`, `bugfix/nama-bug`, `hotfix/nama-fix`, `fix/nama-fix`, `chore/nama-task`, atau `release/nama-release`.
2. Perubahan ke `local` harus lewat Pull Request dari branch kerja tersebut.
3. Perubahan ke `develop` harus lewat Pull Request dari `local`.
4. Perubahan ke `staging` harus lewat Pull Request dari `develop`.
5. Perubahan ke `main` harus lewat Pull Request dari `staging`.
6. Pull Request ke semua branch tersebut menjalankan `Validasi aturan Pull Request`, `Validasi file sensitif`, `Pemeriksaan Laravel`, `Audit dependency`, `Scan keamanan Semgrep`, `Scan secret dengan Gitleaks`, dan `Analisis keamanan CodeQL`.
7. Push langsung ke `local`, `develop`, `staging`, dan `main` akan dibuat gagal oleh workflow, lalu harus dikunci permanen dengan Rulesets/Branch Protection.

## Ruleset untuk `main` dan `staging`

1. Buka `Settings` -> `Rules` -> `Rulesets` atau `Settings` -> `Branches`.
2. Buat aturan untuk branch `main` dan `staging`.
3. Aktifkan `Require a pull request before merging`.
4. Aktifkan `Require status checks to pass`.
5. Pilih status check `Validasi aturan Pull Request`.
6. Pilih status check `Validasi file sensitif`.
7. Pilih status check `Pemeriksaan Laravel`.
8. Pilih status check `Audit dependency`.
9. Pilih status check `Scan keamanan Semgrep`.
10. Pilih status check `Scan secret dengan Gitleaks`.
11. Pilih status check `Analisis keamanan CodeQL`.
12. Aktifkan `Require approvals` dan tentukan minimal `1` approval.
13. Aktifkan `Require review from Code Owners`. File `.github/CODEOWNERS` sudah diset agar hanya `@rezasaputra4250` yang menjadi owner semua perubahan.
14. Aktifkan `Restrict updates` atau `Restrict who can push to matching branches`.
15. Masukkan user/team yang boleh update `main` dan `staging`.
16. Aktifkan `Block force pushes`.
17. Aktifkan `Restrict deletions`.
18. Jika tersedia, aktifkan `Do not allow bypassing the above settings`.

## Ruleset untuk `develop`

1. `develop` hanya boleh menerima Pull Request dari `local`.
2. Aktifkan `Require a pull request before merging`.
3. Aktifkan `Require status checks to pass`.
4. Pilih status check `Validasi aturan Pull Request`.
5. Pilih status check `Validasi file sensitif`.
6. Pilih status check `Pemeriksaan Laravel`.
7. Pilih status check `Audit dependency`.
8. Pilih status check `Scan keamanan Semgrep`.
9. Pilih status check `Scan secret dengan Gitleaks`.
10. Pilih status check `Analisis keamanan CodeQL`.
11. Aktifkan `Block force pushes`.
12. Aktifkan `Restrict deletions`.

## Ruleset untuk `local`

1. `local` hanya boleh menerima Pull Request dari branch kerja seperti `feature/*`, `bugfix/*`, `hotfix/*`, `fix/*`, `chore/*`, atau `release/*`.
2. Aktifkan `Require a pull request before merging`.
3. Aktifkan `Require status checks to pass`.
4. Pilih status check `Validasi aturan Pull Request`.
5. Pilih status check `Validasi file sensitif`.
6. Pilih status check `Pemeriksaan Laravel`.
7. Pilih status check `Audit dependency`.
8. Pilih status check `Scan keamanan Semgrep`.
9. Pilih status check `Scan secret dengan Gitleaks`.
10. Pilih status check `Analisis keamanan CodeQL`.
11. Tetap aktifkan `Block force pushes` dan `Restrict deletions` jika branch ini dipakai bersama.

## Hook lokal untuk developer

Repo ini menyediakan hook lokal di `tools/hooks/pre-push`.

Pasang hook dengan PowerShell:

```powershell
./tools/install-git-hooks.ps1
```

Hook ini akan menolak push langsung ke `local`, `develop`, `staging`, dan `main`, lalu menjalankan test dan build sebelum push dari branch kerja.

## Dependabot

File `.github/dependabot.yml` akan membuat Pull Request otomatis ke branch `local` untuk update Composer, NPM, dan GitHub Actions.

## Deployment server

Branch `staging` dan `main` tidak boleh membuat server update sendiri saat ada push atau merge.

Gunakan panduan `.github/DEPLOYMENT_PROTECTION.md` dan workflow `.github/workflows/manual-deploy.yml`.

Intinya:

1. Jangan pakai trigger deploy `push` untuk `staging` atau `main`.
2. Deploy hanya boleh manual lewat `workflow_dispatch`.
3. Environment `staging` dan `production` wajib approval dari `@rezasaputra4250`.
4. Matikan webhook, cron, atau panel hosting yang auto-pull dari `staging` atau `main`.

Dengan pengaturan ini, branch kerja seperti `feature/*` dan `bugfix/*` tetap fleksibel untuk developer, sedangkan `local`, `develop`, `staging`, dan `main` hanya bisa diubah lewat Pull Request yang sudah disetujui oleh `@rezasaputra4250` dan lolos semua check.
