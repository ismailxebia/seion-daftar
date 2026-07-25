export interface AgeGroup {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
  icon: string;
  coloringCat: string | null;
  fashionCat: string | null;
  dexterityList: string[];
}

export interface AdultGroup {
  title: string;
  items: string[];
}

export interface CareTeamMember {
  name: string;
  role: string;
  phone: string;
  avatar: string;
}

export interface RegistrationParticipant {
  id: string;
  type: string;
  namaPeserta: string;
  umur?: number;
  kategoriGroup: string;
  lomba: string[];
  namaOrangTua?: string;
  whatsapp: string;
  blokRumah: string;
  code: string;
  createdAt?: any;
}

export const AGE_GROUPS: AgeGroup[] = [
  {
    id: 'toddler',
    label: 'Toddler (1–3 Tahun)',
    minAge: 1,
    maxAge: 3,
    icon: '👶',
    coloringCat: null,
    fashionCat: null,
    dexterityList: [
      'Mencocokan Warna Bola (Minggu, 9 Ags)',
      'Pindahkan Air dengan Spons (Minggu, 9 Ags)'
    ]
  },
  {
    id: 'tk',
    label: 'TK / Playgroup (4–6 Tahun)',
    minAge: 4,
    maxAge: 6,
    icon: '👦',
    coloringCat: 'Lomba Mewarnai Playgroup & TK (Sabtu, 15 Ags)',
    fashionCat: 'Fashion Show Nusantara Usia 3–6 Thn (Senin, 17 Ags)',
    dexterityList: [
      'Pindahkan Karet dengan Sumpit (Minggu, 9 Ags)',
      'Pindahkan Air ke Botol (Minggu, 9 Ags)'
    ]
  },
  {
    id: 'sd_1_3',
    label: 'SD Kelas 1–3 (7–9 Tahun)',
    minAge: 7,
    maxAge: 9,
    icon: '🎒',
    coloringCat: 'Lomba Mewarnai SD Kelas 1–3 (Sabtu, 15 Ags)',
    fashionCat: 'Fashion Show Nusantara Usia 7–11 Thn (Senin, 17 Ags)',
    dexterityList: [
      'Lomba Lari dengan Balon (Minggu, 9 Ags)',
      'Pindahkan Air dengan Sedotan (Minggu, 9 Ags)',
      'Estafet Gelas dengan Jepitan Baju (Minggu, 9 Ags)'
    ]
  },
  {
    id: 'sd_4_6',
    label: 'SD Kelas 4–6 (10–12 Tahun)',
    minAge: 10,
    maxAge: 12,
    icon: '⚽',
    coloringCat: 'Lomba Mewarnai SD Kelas 4–6 (Sabtu, 15 Ags)',
    fashionCat: 'Fashion Show Nusantara Usia 7–11 Thn (Senin, 17 Ags)',
    dexterityList: [
      'Memasukkan Sedotan ke Botol dengan Hidung (Minggu, 9 Ags)',
      'Tiup Bola di Air (Minggu, 9 Ags)',
      'Estafet Hanger Baju (Minggu, 9 Ags)'
    ]
  },
  {
    id: 'smp',
    label: 'SMP / Remaja (13–17 Tahun)',
    minAge: 13,
    maxAge: 17,
    icon: '🏆',
    coloringCat: null,
    fashionCat: 'Fashion Show Nusantara Usia 12–17 Thn (Senin, 17 Ags)',
    dexterityList: [
      'Keluarkan Bola dari Kardus (Minggu, 9 Ags)',
      'Pindahkan Gelas dengan Balon (Minggu, 9 Ags)',
      'Estafet Bola Poli (Minggu, 9 Ags)'
    ]
  }
];

export const ADULT_GROUPS: AdultGroup[] = [
  {
    title: 'Lomba Pasutri (Minggu, 16 Ags)',
    items: [
      'Make Up Pasangan',
      'Joget Balon Pasutri'
    ]
  },
  {
    title: 'Lomba Bapak-Bapak (Minggu, 16 Ags)',
    items: [
      'Tendangan Penalti',
      'Lempar Bola Pakai Sarung'
    ]
  },
  {
    title: 'Lomba Ibu-Ibu (Minggu, 16 Ags)',
    items: [
      'Kepiting Air',
      'Balap Kelereng di Dalam Kolam Renang'
    ]
  },
  {
    title: 'Kebersamaan & Keluarga',
    items: [
      'Parade Sepeda Hias (16 Ags)',
      'Jalan Santai Keluarga (16 Ags)',
      'Lomba Foto Keluarga (17 Ags)'
    ]
  }
];

export const CARE_TEAM: CareTeamMember[] = [
  { name: 'Safira', role: 'Koordinator Pendaftaran', phone: '085697771178', avatar: '👩‍💼' },
  { name: 'Aqhila', role: 'Humas & Acara Seion', phone: '087882063197', avatar: '👩‍💻' }
];
