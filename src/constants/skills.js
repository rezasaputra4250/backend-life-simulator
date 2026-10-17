const skills = [
  {
    name: 'productivity',
    label: 'Produktivitas',
    description: 'Kemampuan menyelesaikan tugas secara konsisten.',
  },
  {
    name: 'communication',
    label: 'Komunikasi',
    description: 'Kemampuan menyampaikan informasi dengan jelas.',
  },
  {
    name: 'leadership',
    label: 'Kepemimpinan',
    description: 'Kemampuan mengarahkan dan membantu tim.',
  },
  {
    name: 'problem_solving',
    label: 'Pemecahan Masalah',
    description: 'Kemampuan menganalisis masalah dan menemukan solusi.',
  },
  {
    name: 'technical',
    label: 'Teknis',
    description: 'Kemampuan teknis sesuai kebutuhan pekerjaan.',
  },
  {
    name: 'focus',
    label: 'Fokus',
    description: 'Kemampuan menjaga perhatian pada satu tujuan tanpa mudah terdistraksi.',
  },
  {
    name: 'critical_thinking',
    label: 'Berpikir Kritis',
    description: 'Kemampuan menilai informasi secara logis sebelum mengambil keputusan.',
  },
  {
    name: 'research',
    label: 'Riset',
    description: 'Kemampuan mencari, memeriksa, dan merangkum informasi yang dapat dipercaya.',
  },
  {
    name: 'time_management',
    label: 'Manajemen Waktu',
    description: 'Kemampuan menyusun prioritas dan menyelesaikan pekerjaan tepat waktu.',
  },
  {
    name: 'presentation',
    label: 'Presentasi',
    description: 'Kemampuan menyampaikan ide dengan runtut dan menarik di depan orang lain.',
  },
  {
    name: 'collaboration',
    label: 'Kolaborasi',
    description: 'Kemampuan bekerja bersama, berbagi peran, dan mencapai hasil sebagai tim.',
  },
  {
    name: 'endurance',
    label: 'Ketahanan',
    description: 'Kemampuan menjaga tenaga dan konsistensi saat menghadapi pekerjaan berat.',
  },
  {
    name: 'cultivation',
    label: 'Budi Daya',
    description: 'Kemampuan merawat, mengembangkan, dan memanfaatkan sumber daya alam secara bijak.',
  },
  {
    name: 'resource_management',
    label: 'Pengelolaan Sumber Daya',
    description: 'Kemampuan menggunakan waktu, alat, bahan, dan tenaga secara efisien.',
  },
  {
    name: 'discipline',
    label: 'Disiplin',
    description: 'Kemampuan menjalankan kebiasaan dan tanggung jawab secara konsisten.',
  },
  {
    name: 'professional_writing',
    label: 'Penulisan Profesional',
    description: 'Kemampuan menulis pesan, laporan, dan dokumen kerja dengan jelas.',
  },
  {
    name: 'adaptability',
    label: 'Adaptasi',
    description: 'Kemampuan menyesuaikan diri dengan perubahan, alat, dan situasi baru.',
  },
  {
    name: 'creativity',
    label: 'Kreativitas',
    description: 'Kemampuan menghasilkan gagasan baru yang berguna dan berbeda.',
  },
  {
    name: 'negotiation',
    label: 'Negosiasi',
    description: 'Kemampuan mencari kesepakatan yang adil melalui komunikasi dan pertimbangan.',
  },
  {
    name: 'financial_literacy',
    label: 'Literasi Keuangan',
    description: 'Kemampuan mengatur pemasukan, pengeluaran, risiko, dan perencanaan keuangan.',
  },
  {
    name: 'marketing',
    label: 'Pemasaran',
    description: 'Kemampuan memahami kebutuhan orang dan menyampaikan nilai sebuah produk atau jasa.',
  },
  {
    name: 'client_management',
    label: 'Pengelolaan Klien',
    description: 'Kemampuan memahami kebutuhan klien, mengatur ekspektasi, dan menjaga kepercayaan.',
  },
  {
    name: 'self_management',
    label: 'Pengelolaan Diri',
    description: 'Kemampuan mengatur target, energi, dan tanggung jawab secara mandiri.',
  },
  {
    name: 'digital_tools',
    label: 'Perangkat Digital',
    description: 'Kemampuan menggunakan perangkat dan aplikasi digital untuk bekerja lebih efektif.',
  },
];

const skillsByClass = {
  pelajar: ['focus', 'critical_thinking', 'research', 'time_management'],
  mahasiswa: ['research', 'critical_thinking', 'presentation', 'collaboration'],
  petani: ['endurance', 'cultivation', 'resource_management', 'discipline'],
  karyawan: ['time_management', 'collaboration', 'professional_writing', 'adaptability'],
  wirausahawan: ['creativity', 'negotiation', 'financial_literacy', 'marketing'],
  pekerja_lepas: ['adaptability', 'client_management', 'self_management', 'digital_tools'],
};

module.exports = {
  skills,
  skillsByClass,
};
