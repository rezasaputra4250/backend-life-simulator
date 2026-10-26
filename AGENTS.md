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

## Log Keputusan Pengembangan

- 2026-10-18 — Alur branch dikunci sebagai `feature/* -> local -> develop -> staging -> main`. Setiap masalah utama dibuat dalam branch dan PR terpisah menuju `local`.
- 2026-10-18 — Environment aplikasi dipisahkan menjadi `local`, `development`, `staging`, dan `production`. Branch tetap memakai `develop`; environment `development` dipetakan ke branch tersebut. Perpindahan environment dilakukan melalui satu file `.env` lokal, sedangkan `.env.example` menjadi dokumentasi tanpa secret.
- 2026-10-18 — Preferensi agama ditambahkan ke profil dan misi dapat memiliki `required_religion`. Misi umum tetap tersedia untuk semua pengguna, sedangkan misi agama hanya diberikan setelah preferensi tersimpan.
- 2026-10-18 — `streak_days` tetap menjadi bagian dari sistem misi. API sekarang mendokumentasikan status `active`, `pending`, `broken`, atau `none`, serta `last_completed_date`.
- 2026-10-18 — Notification backend dipertahankan. Penghapusan notifikasi inline dilakukan pada lapisan mobile melalui mekanisme modal terpusat.

## Status Milestone

- Selesai di branch/PR terpisah: konfigurasi environment, penyaringan misi berdasarkan agama, dan detail status streak.
- Implementasi mobile yang sudah dibuat: form in-app sebagai modal, header navigasi profile, onboarding agama, dan navigasi reward skill ke `/profile/skills`.
- Branch dokumentasi ini menjaga keputusan teknis di atas tetap terlihat oleh agent dan kontributor berikutnya.

## Standar Pull Request

- Gunakan Bahasa Indonesia untuk judul dan isi PR. Istilah teknis seperti nama branch, endpoint, field, dan `APP_ENV` boleh tetap dalam Bahasa Inggris.
- Gunakan judul singkat dengan format Conventional Commits, misalnya `feat: tambahkan filter misi berdasarkan agama`.
- Gunakan struktur sederhana: `Tujuan`, `Perubahan`, `Validasi`, dan `Target merge`.
- Jelaskan konteks masalah, perubahan yang dibuat, dan dampaknya dengan kalimat singkat.
- Gunakan daftar perubahan yang spesifik agar reviewer mudah memeriksa scope PR.
- Cantumkan keterbatasan validasi secara jujur dan jangan menyatakan test lulus jika belum dijalankan.
- Jelaskan langkah manual yang perlu dilakukan reviewer jika perubahan membutuhkan konfigurasi atau migrasi.
- Semua PR fitur dan perbaikan diarahkan ke `local`.
