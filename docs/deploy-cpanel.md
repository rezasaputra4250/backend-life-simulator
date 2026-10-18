# Deploy backend ke cPanel

Workflow `.github/workflows/cpanel-auto-pull.yml` melakukan deploy otomatis ketika branch `develop` atau `staging` menerima perubahan. Branch `main` dan `master` tidak pernah deploy otomatis dan hanya dapat dideploy manual dari GitHub Actions.

## Secret GitHub Actions

Buat secret berikut pada environment GitHub yang sesuai (`development`, `staging`, atau `production`):

| Secret | Isi |
| --- | --- |
| `CPANEL_SSH_HOST` | Hostname atau IP SSH cPanel |
| `CPANEL_SSH_PORT` | Port SSH, opsional dan default `22` |
| `CPANEL_SSH_USER` | Username cPanel |
| `CPANEL_SSH_PRIVATE_KEY` | Private key SSH untuk login dari GitHub Actions ke cPanel |
| `CPANEL_SSH_KNOWN_HOSTS` | Output `ssh-keyscan -H host -p port` dari server cPanel |
| `CPANEL_BACKEND_PATH` | Path absolut repository backend di server, misalnya `/home/user/backend` |
| `CPANEL_NPM_BIN` | Path binary npm cPanel, opsional dan default `npm` |

Private key hanya disimpan di GitHub Secrets. Jangan menaruhnya di `.env`, workflow, atau repository.
Nilai `CPANEL_SSH_KNOWN_HOSTS` digunakan untuk memverifikasi identitas server dan mencegah koneksi SSH ke host palsu.

## Persiapan server cPanel

1. Buat SSH key untuk GitHub Actions dan tambahkan public key ke `~/.ssh/authorized_keys` pada akun cPanel.
2. Pastikan repository backend sudah di-clone di `CPANEL_BACKEND_PATH` dan remote `origin` dapat melakukan `git fetch` dari GitHub. Gunakan deploy key read-only di server jika repository private.
3. Pastikan aplikasi sudah dibuat melalui **Setup Node.js App** cPanel.
4. Pastikan binary npm yang dipakai aplikasi sama dengan nilai `CPANEL_NPM_BIN`.
5. Pastikan file `.env` production berada di server dan tidak dilacak Git.
6. Pastikan folder `tmp` dapat ditulis oleh aplikasi. Workflow membuat `tmp/restart.txt` untuk memicu restart Passenger.

## Urutan deploy

Workflow menjalankan langkah berikut di server:

1. `git fetch origin <branch-deploy>`
2. `git checkout <branch-deploy>`
3. `git reset --hard origin/<branch-deploy>`
4. `npm ci --omit=dev`
5. `npm run migrate`
6. Membuat `tmp/restart.txt`

`git reset --hard` hanya dijalankan pada repository deploy di server. Jangan menyimpan perubahan manual yang belum di-commit di folder tersebut karena akan dihapus pada deploy berikutnya.

## Aturan branch

| Branch | Deploy otomatis | Deploy manual | Target |
| --- | --- | --- | --- |
| `develop` | Ya | Ya | `development` |
| `staging` | Ya | Ya | `staging` |
| `main` | Tidak | Ya | `production` |
| `master` | Tidak | Ya | `production` |

Untuk deploy `main` atau `master`, buka GitHub Actions, pilih workflow **Deploy Backend ke cPanel**, klik **Run workflow**, lalu pilih branch dan target `production`.
