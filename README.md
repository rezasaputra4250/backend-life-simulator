# RPG Life Simulator Backend

Backend aplikasi RPG Life Simulator berbasis Express dan Node.js.

## Kondisi repository saat ini

Repository menggunakan alur promosi branch berikut:

```text
feature/*, bugfix/*, hotfix/*, fix/*, chore/*, release/*
                              |
                              v
                            local
                              |
                              v
                           develop
                              |
                              v
                           staging
                              |
                              v
                            main
```

`local` adalah gerbang pertama untuk seluruh pekerjaan. Tidak ada branch kerja yang boleh langsung masuk ke `develop`, `staging`, atau `main`.

Aturan PR yang berlaku:

| Branch tujuan | Branch sumber yang diizinkan | Fungsi |
| --- | --- | --- |
| `local` | `feature/*`, `bugfix/*`, `hotfix/*`, `fix/*`, `chore/*`, `release/*` | Integrasi awal dan validasi perubahan |
| `develop` | `local` | Integrasi pengembangan |
| `staging` | `develop` | Uji pra-produksi |
| `main` | `staging` | Produksi |

Branch `master` masih tercakup dalam aturan perlindungan sebagai kompatibilitas, tetapi `main` adalah branch produksi yang digunakan.

## Cara kerja branch

1. Buat branch kerja baru dari `local`.
2. Kerjakan perubahan dan jalankan test secara lokal.
3. Buka Pull Request ke `local`.
4. Setelah PR ke `local` disetujui dan semua pemeriksaan lulus, buka PR `local` ke `develop`.
5. Promosikan perubahan secara berurutan dari `develop` ke `staging`, lalu dari `staging` ke `main`.
6. Deploy production hanya menggunakan `main` dan proses manual yang telah disetujui.

Contoh perintah:

```bash
git fetch origin
git switch local
git pull --ff-only origin local
git switch -c feature/nama-fitur
```

## Pemeriksaan otomatis

Pull Request menuju branch terlindungi menjalankan pemeriksaan berikut:

- Validasi aturan alur Pull Request
- Validasi file sensitif dan pola secret
- Test Node.js (`npm test`)
- Audit dependency production
- Scan keamanan Semgrep
- Scan secret dengan Gitleaks
- Analisis keamanan CodeQL

Konfigurasi workflow berada di `.github/workflows/`. Aturan import GitHub Ruleset tersedia di `.github/rulesets/branch-protection.json`.

## Pengaturan wajib di GitHub

File konfigurasi di repository perlu dilengkapi dengan pengaturan pada GitHub:

1. Import atau aktifkan ruleset untuk `local`, `develop`, `staging`, dan `main`.
2. Wajibkan Pull Request, minimal satu approval, review Code Owners, dan seluruh status check lulus.
3. Blokir force push dan penghapusan branch terlindungi.
4. Pastikan aturan sumber PR sesuai tabel alur di atas.
5. Atur environment `staging` dan `production` dengan required reviewer.

Tanpa pengaturan GitHub tersebut, workflow hanya dapat memberi status gagal atau berhasil; workflow tidak dapat mencegah push langsung ke branch.

## Deployment

- `develop` digunakan untuk lingkungan development.
- `staging` digunakan untuk pengujian pra-produksi.
- `main` digunakan untuk production.
- Deploy staging dan production mengikuti approval environment dan tidak boleh bergantung pada auto-pull server.

Detail perlindungan deployment tersedia di `.github/DEPLOYMENT_PROTECTION.md`, sedangkan panduan cPanel tersedia di `docs/deploy-cpanel.md`.

## Menjalankan backend secara lokal

Salin `.env.example` menjadi `.env`, lalu isi nilai lokal yang diperlukan. Jangan commit `.env` atau credential asli.

```bash
npm ci
npm test
npm run dev
```

Endpoint dan konfigurasi aplikasi mengikuti struktur pada folder `src/`.

## Referensi repository

- `.github/BRANCH_PROTECTION.md` — panduan detail branch protection
- `.github/pull_request_template.md` — checklist Pull Request
- `.github/workflows/protected-branches.yml` — validasi alur branch
- `.github/workflows/manual-deploy.yml` — guard deployment manual
- `docs/rpg-master-audit.md` — catatan audit backend
