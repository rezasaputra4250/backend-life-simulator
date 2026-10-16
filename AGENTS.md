# AGENTS.md

## Catatan Proyek

- Gunakan Bahasa Indonesia untuk komunikasi, penjelasan perubahan, dan laporan hasil kepada pengguna. Pertahankan Bahasa Inggris hanya untuk identitas teknis yang memang digunakan oleh kode atau tooling.
- Ini adalah proyek backend untuk aplikasi Express/Node.js.
- Gunakan bahasa Inggris untuk implementasi dan identitas teknis, termasuk kode, nama variabel, nama file, nama route, field database, komentar, log, dan pesan commit.
- Gunakan Bahasa Indonesia untuk konten yang terlihat oleh pengguna, termasuk pesan API, pesan validasi, teks respons, label, dan data tampilan awal.
- Utamakan pola Express yang jelas, konsisten, dan umum digunakan sebelum menambahkan abstraksi baru.
- Buat perubahan sekecil mungkin dan tetap fokus pada tugas yang diminta.

## Alur Git

- Alur branch utama: `local` -> `develop` -> `staging` -> `main`.
- Setelah setiap perubahan selesai, termasuk perubahan kecil, jalankan validasi yang relevan lalu buat commit dengan pesan yang jelas.
- Jangan commit `node_modules/`, `.env`, log, hasil build, folder cache, upload, atau secret lokal.
- Gunakan `.env.example` untuk mendokumentasikan environment variable jika diperlukan.

## Konvensi API

- Gunakan bahasa Inggris untuk path endpoint dan key JSON.
- Gunakan Bahasa Indonesia untuk pesan yang dikembalikan kepada pengguna atau client.
- Jaga bentuk respons agar konsisten di semua endpoint.
- Validasi input request sebelum digunakan.

## Pengingat Penting

- Jangan edit file di dalam `node_modules/`.
- Jangan menimpa perubahan pengguna kecuali diminta secara eksplisit.
- Jika tugas memengaruhi perilaku runtime, jalankan test yang relevan atau minimal pengecekan syntax/build jika tersedia.
