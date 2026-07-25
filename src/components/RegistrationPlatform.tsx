'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, 
  Trash2, Printer, FileSpreadsheet, Phone, 
  Check, ChevronDown, Users, AlertCircle, RefreshCw, 
  Clock, Home, X, CheckCircle2, Lock, KeyRound, ShieldCheck,
  Baby, Sparkles, BookOpen, Trophy, GraduationCap, User
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db, appId } from '@/lib/firebase';
import { 
  AGE_GROUPS, 
  ADULT_GROUPS, 
  CARE_TEAM, 
  RegistrationParticipant 
} from '@/data/masterData';

export default function RegistrationPlatform() {
  const [activeTab, setActiveTab] = useState<'register' | 'participants' | 'schedule'>('register');
  const [formType, setFormType] = useState<'children' | 'adults' | 'performers'>('children');

  // Firebase State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<RegistrationParticipant[]>([]);
  const [ticketModal, setTicketModal] = useState<RegistrationParticipant | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

  // Admin Access Protection State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('seion_admin_unlocked') === 'true';
    }
    return false;
  });
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form State - Anak (Umur dihapus)
  const [childData, setChildData] = useState({
    namaAnak: '',
    tingkatanId: '',
    selectedLomba: [] as string[],
    namaOrangTua: '',
    whatsapp: '',
    blokRumah: ''
  });

  // Form State - Dewasa
  const [adultData, setAdultData] = useState({
    namaPeserta: '',
    selectedLomba: [] as string[],
    whatsapp: '',
    blokRumah: ''
  });

  // Form State - Pengisi Acara
  const [performerData, setPerformerData] = useState({
    namaPenampil: '',
    jenisPenampilan: 'Menyanyi',
    tipe: 'Individu',
    jumlahOrang: '1',
    whatsapp: '',
    blokRumah: ''
  });

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Firebase Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Auth initialization fallback:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firestore Synchronization
  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
    
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: RegistrationParticipant[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as RegistrationParticipant);
        });
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setParticipants(list);
      },
      (error) => {
        console.warn("Firestore sync offline fallback:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Tab Navigation Guard for Admin Protection
  const handleTabClick = (tab: 'register' | 'participants' | 'schedule') => {
    if (tab === 'participants' && !isAdminUnlocked) {
      setPinError('');
      setPinInput('');
      setShowPinModal(true);
      return;
    }
    setActiveTab(tab);
  };

  // PIN Verification Handler
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '2200') {
      setIsAdminUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('seion_admin_unlocked', 'true');
      }
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      setActiveTab('participants');
    } else {
      setPinError('PIN Salah! Kode akses yang Anda masukkan tidak cocok.');
      setPinInput('');
    }
  };

  // Admin Logout Handler
  const handleAdminLogout = () => {
    setIsAdminUnlocked(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('seion_admin_unlocked');
    }
    if (activeTab === 'participants') {
      setActiveTab('register');
    }
  };

  // Helper untuk Icon Line Tingkatan Sekolah
  const renderGroupIcon = (id: string, className = "w-4 h-4 text-slate-500") => {
    switch (id) {
      case 'toddler':
        return <Baby className={className} />;
      case 'tk':
        return <Sparkles className={className} />;
      case 'sd_1_3':
        return <BookOpen className={className} />;
      case 'sd_4_6':
        return <Trophy className={className} />;
      case 'smp':
        return <GraduationCap className={className} />;
      default:
        return <User className={className} />;
    }
  };

  // Handler: Tingkatan Dropdown Selection
  const handleSelectTingkatan = (catId: string) => {
    setChildData(prev => ({
      ...prev,
      tingkatanId: catId,
      selectedLomba: []
    }));
    setIsDropdownOpen(false);
  };

  const toggleChildLomba = (item: string) => {
    setChildData(prev => {
      const exists = prev.selectedLomba.includes(item);
      return {
        ...prev,
        selectedLomba: exists 
          ? prev.selectedLomba.filter(i => i !== item)
          : [...prev.selectedLomba, item]
      };
    });
  };

  const toggleAdultLomba = (item: string) => {
    setAdultData(prev => {
      const exists = prev.selectedLomba.includes(item);
      return {
        ...prev,
        selectedLomba: exists 
          ? prev.selectedLomba.filter(i => i !== item)
          : [...prev.selectedLomba, item]
      };
    });
  };

  // Submit Handler
  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const code = 'SEION-' + Math.floor(10000 + Math.random() * 90000);
    let payload: Omit<RegistrationParticipant, 'id'> | null = null;

    if (formType === 'children') {
      if (!childData.namaAnak.trim()) { alert("Nama anak wajib diisi!"); setLoading(false); return; }
      if (!childData.tingkatanId) { alert("Tingkatan sekolah wajib dipilih!"); setLoading(false); return; }
      if (childData.selectedLomba.length === 0) { alert("Pilih minimal 1 lomba!"); setLoading(false); return; }
      if (!childData.blokRumah.trim()) { alert("Blok / No. Rumah wajib diisi!"); setLoading(false); return; }

      const selectedCatObj = AGE_GROUPS.find(g => g.id === childData.tingkatanId);

      payload = {
        type: 'Anak / Remaja',
        namaPeserta: childData.namaAnak.trim(),
        kategoriGroup: selectedCatObj ? selectedCatObj.label : 'Anak-Anak',
        lomba: childData.selectedLomba,
        namaOrangTua: childData.namaOrangTua.trim() || '-',
        whatsapp: childData.whatsapp.trim() || '-',
        blokRumah: childData.blokRumah.trim(),
        code: code,
        createdAt: serverTimestamp()
      };
    } else if (formType === 'adults') {
      if (!adultData.namaPeserta.trim()) { alert("Nama peserta / pasangan wajib diisi!"); setLoading(false); return; }
      if (adultData.selectedLomba.length === 0) { alert("Pilih minimal 1 lomba!"); setLoading(false); return; }
      if (!adultData.blokRumah.trim()) { alert("Blok / No. Rumah wajib diisi!"); setLoading(false); return; }

      payload = {
        type: 'Dewasa / Pasutri',
        namaPeserta: adultData.namaPeserta.trim(),
        kategoriGroup: 'Dewasa & Umum',
        lomba: adultData.selectedLomba,
        whatsapp: adultData.whatsapp.trim() || '-',
        blokRumah: adultData.blokRumah.trim(),
        code: code,
        createdAt: serverTimestamp()
      };
    } else if (formType === 'performers') {
      if (!performerData.namaPenampil.trim()) { alert("Nama penampil wajib diisi!"); setLoading(false); return; }
      if (!performerData.blokRumah.trim()) { alert("Blok / No. Rumah wajib diisi!"); setLoading(false); return; }

      payload = {
        type: 'Pengisi Acara (Malam Puncak)',
        namaPeserta: performerData.namaPenampil.trim(),
        kategoriGroup: `Pengisi Acara (${performerData.jenisPenampilan})`,
        lomba: [`Pengisi Acara: ${performerData.jenisPenampilan} (${performerData.tipe} - ${performerData.jumlahOrang} Orang)`],
        whatsapp: performerData.whatsapp.trim() || '-',
        blokRumah: performerData.blokRumah.trim(),
        code: code,
        createdAt: serverTimestamp()
      };
    }

    if (!payload) {
      setLoading(false);
      return;
    }

    try {
      if (user) {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
        const docRef = await addDoc(colRef, payload);
        const savedData: RegistrationParticipant = { id: docRef.id, ...payload };
        setTicketModal(savedData);
      } else {
        const mockDoc: RegistrationParticipant = { id: 'local-' + Date.now(), ...payload };
        setParticipants(prev => [mockDoc, ...prev]);
        setTicketModal(mockDoc);
      }

      // Reset Forms
      setChildData({ namaAnak: '', tingkatanId: '', selectedLomba: [], namaOrangTua: '', whatsapp: '', blokRumah: '' });
      setAdultData({ namaPeserta: '', selectedLomba: [], whatsapp: '', blokRumah: '' });
      setPerformerData({ namaPenampil: '', jenisPenampilan: 'Menyanyi', tipe: 'Individu', jumlahOrang: '1', whatsapp: '', blokRumah: '' });
    } catch (err) {
      console.warn("Save warning fallback to local storage:", err);
      const mockDoc: RegistrationParticipant = { id: 'local-' + Date.now(), ...payload };
      setParticipants(prev => [mockDoc, ...prev]);
      setTicketModal(mockDoc);
    } finally {
      setLoading(false);
    }
  };

  // Delete Confirmation
  const confirmDelete = async () => {
    if (!deleteModalId) return;
    try {
      if (user && !deleteModalId.startsWith('local-')) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registrations', deleteModalId));
      } else {
        setParticipants(prev => prev.filter(p => p.id !== deleteModalId));
      }
    } catch (err) {
      console.warn("Delete error fallback:", err);
      setParticipants(prev => prev.filter(p => p.id !== deleteModalId));
    } finally {
      setDeleteModalId(null);
    }
  };

  // AUDITED & REFINED EXCEL / CSV EXPORT
  const exportToExcel = () => {
    if (participants.length === 0) {
      alert("Belum ada data peserta untuk diunduh.");
      return;
    }

    const cleanField = (val: string | number | undefined) => {
      if (val === undefined || val === null || val === '') return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const cleanPhone = (phone: string | undefined) => {
      if (!phone || phone === '-') return '""';
      const str = String(phone).replace(/"/g, '""');
      return `"='${str}'"`;
    };

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const csvLines: string[] = [];
    csvLines.push(`"REKAP DAFTAR PESERTA LOMBA KEMERDEKAAN SEION 2026"`);
    csvLines.push(`"HUT RI Ke-81 Cluster Mizu & B9-B10"`);
    csvLines.push(`"Tanggal Ekspor: ${todayStr} | Total: ${participants.length} Peserta"`);
    csvLines.push('');

    const headers = [
      "No.",
      "Kode Reg",
      "Nama Peserta",
      "Umur",
      "Tipe Pendaftaran",
      "Kategori / Tingkatan",
      "Cabang Lomba Diikuti",
      "Nama Orang Tua",
      "Blok / Rumah",
      "No. WhatsApp"
    ];
    csvLines.push(headers.map(h => `"${h}"`).join(','));

    participants.forEach((p, index) => {
      const lombaStr = Array.isArray(p.lomba) ? p.lomba.join('; ') : '-';
      const row = [
        index + 1,
        cleanField(p.code || '-'),
        cleanField(p.namaPeserta || '-'),
        cleanField(p.umur ? `${p.umur} Thn` : '-'),
        cleanField(p.type || '-'),
        cleanField(p.kategoriGroup || '-'),
        cleanField(lombaStr),
        cleanField(p.namaOrangTua || '-'),
        cleanField(p.blokRumah || '-'),
        cleanPhone(p.whatsapp)
      ];
      csvLines.push(row.join(','));
    });

    const csvString = "\uFEFF" + csvLines.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_Peserta_Lomba_Seion_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered Participants
  const filteredParticipants = participants.filter(p => {
    return p.namaPeserta?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.blokRumah?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.namaOrangTua?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedGroupObj = AGE_GROUPS.find(g => g.id === childData.tingkatanId);
  const activeSelectedCategoryObj = selectedGroupObj;
  const formattedToday = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#FAFBF8] text-slate-800 font-sans antialiased selection:bg-[#D2F54E] selection:text-slate-900 pb-32">
      
      {/* ---------------------------------------------------- */}
      {/* PRINT-ONLY OFFICIAL REPORT LAYOUT (HIDDEN ON SCREEN, VISIBLE ON PRINT/PDF) */}
      {/* ---------------------------------------------------- */}
      <div className="hidden print:block w-full p-6">
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
            REKAP DAFTAR PESERTA LOMBA KEMERDEKAAN SEION 2026
          </h1>
          <p className="text-xs text-slate-600 font-bold mt-1">
            HUT RI Ke-81 Cluster Mizu & B9–B10
          </p>
          <div className="flex justify-between items-center text-[10pt] text-slate-600 mt-3 pt-1 border-t border-slate-300">
            <span>Tanggal Cetak: <strong>{formattedToday}</strong></span>
            <span>Total Pendaftar: <strong>{filteredParticipants.length} Peserta</strong></span>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '5%', textAlign: 'center' }}>No</th>
              <th style={{ width: '14%' }}>Kode Reg</th>
              <th style={{ width: '20%' }}>Nama Peserta</th>
              <th style={{ width: '16%' }}>Kategori / Umur</th>
              <th style={{ width: '25%' }}>Lomba Diikuti</th>
              <th style={{ width: '12%' }}>Ortu / WA</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Blok</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((p, idx) => (
              <tr key={p.id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                <td style={{ fontWeight: 'bold' }}>{p.namaPeserta}</td>
                <td>
                  <div>{p.kategoriGroup}</div>
                  {p.umur && <div style={{ fontSize: '8.5pt', color: '#475569' }}>({p.umur} Thn)</div>}
                </td>
                <td>
                  <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'disc' }}>
                    {p.lomba?.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </td>
                <td>
                  <div>{p.namaOrangTua || '-'}</div>
                  <div style={{ fontSize: '8.5pt', color: '#475569' }}>{p.whatsapp}</div>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{p.blokRumah}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tanda Tangan Panitia di Laporan PDF */}
        <div className="mt-12 flex justify-between text-xs text-slate-800" style={{ pageBreakInside: 'avoid' }}>
          <div className="text-center w-52">
            <p>Mengetahui,</p>
            <p className="font-bold mt-1">Koordinator Acara</p>
            <div className="h-16"></div>
            <p className="border-t border-slate-500 font-semibold pt-1">( Panitia Seion 2026 )</p>
          </div>
          <div className="text-center w-52">
            <p>Seion, {formattedToday}</p>
            <p className="font-bold mt-1">Koordinator Pendaftaran</p>
            <div className="h-16"></div>
            <p className="border-t border-slate-500 font-semibold pt-1">( Safira / Aqhila )</p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* WEB DASHBOARD UI (VISIBLE ON SCREEN, HIDDEN ON PRINT/PDF) */}
      {/* ---------------------------------------------------- */}
      
      {/* HEADER BAR */}
      <header className="print:hidden max-w-xl mx-auto px-4 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-[#D2F54E] flex items-center justify-center font-black text-xs shadow-xs shrink-0">
            🇮🇩
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-none">
              Portal Seion 2026
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">HUT RI Ke-81 Cluster Mizu & B9–B10</p>
          </div>
        </div>

        {/* ADMIN ACCESS BUTTON */}
        {isAdminUnlocked ? (
          <button
            onClick={handleAdminLogout}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            title="Keluar dari mode admin"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D2F54E]" />
            <span>Admin (Keluar)</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setPinError('');
              setPinInput('');
              setShowPinModal(true);
            }}
            className="px-3 py-1.5 bg-[#D2F54E] hover:bg-[#bce43a] text-slate-950 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-slate-900" />
            <span>Akses Admin</span>
          </button>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="print:hidden max-w-xl mx-auto px-4 pt-3 space-y-5">

        {/* HERO BANNER WITH BACKGROUND IMAGE & PRECISION FIGMA TABS (Node 237:734) */}
        <div className="relative bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden space-y-5">
          {/* Background Image positioned on right with soft fade gradient */}
          <div 
            className="absolute top-0 right-0 bottom-0 w-full sm:w-[65%] bg-cover bg-right bg-no-repeat pointer-events-none z-0 opacity-95"
            style={{ backgroundImage: `url('/bg-seion-lomba.png')` }}
          >
            {/* Soft fade overlay from white on left to transparent on right */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>

          {/* Header Content */}
          <div className="relative z-10 space-y-2 max-w-sm sm:max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 backdrop-blur-xs text-slate-700 rounded-full text-xs font-normal border border-slate-200/60">
              <span className="w-2 h-2 rounded-full bg-[#83DF22] inline-block shrink-0" />
              <span>Formulir Pendaftaran</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                Semarak Lomba Kemerdekaan Seion
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                Batas pendaftaran : 6 Agu 2026
              </p>
            </div>
          </div>

          {/* FIGMA PRECISION SEGMENTED TABS */}
          <div className="relative z-10 pt-1">
            <div className="bg-white border border-[#f0f0f0] p-[3px] rounded-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] flex items-center gap-[4px] w-full">
              <button
                type="button"
                onClick={() => setFormType('children')}
                className={`flex-1 h-[38px] px-3 text-xs sm:text-sm rounded-full transition-all cursor-pointer flex items-center justify-center whitespace-nowrap ${
                  formType === 'children'
                    ? 'bg-gradient-to-b from-[#d2f54e] to-[#bcdb46] text-[#020617] font-medium shadow-xs'
                    : 'bg-transparent text-[#475569] hover:text-slate-900 font-medium'
                }`}
              >
                Anak & Remaja
              </button>
              <button
                type="button"
                onClick={() => setFormType('adults')}
                className={`flex-1 h-[38px] px-3 text-xs sm:text-sm rounded-full transition-all cursor-pointer flex items-center justify-center whitespace-nowrap ${
                  formType === 'adults'
                    ? 'bg-gradient-to-b from-[#d2f54e] to-[#bcdb46] text-[#020617] font-medium shadow-xs'
                    : 'bg-transparent text-[#475569] hover:text-slate-900 font-medium'
                }`}
              >
                Dewasa/Pasutri
              </button>
              <button
                type="button"
                onClick={() => setFormType('performers')}
                className={`flex-1 h-[38px] px-3 text-xs sm:text-sm rounded-full transition-all cursor-pointer flex items-center justify-center whitespace-nowrap ${
                  formType === 'performers'
                    ? 'bg-gradient-to-b from-[#d2f54e] to-[#bcdb46] text-[#020617] font-medium shadow-xs'
                    : 'bg-transparent text-[#475569] hover:text-slate-900 font-medium'
                }`}
              >
                Pengisi Acara
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: FORM PENDAFTARAN */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            {/* MAIN FORM CARD */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-5">
              
              {/* 1. FORM ANAK & REMAJA */}
              {formType === 'children' && (
                <form onSubmit={handleSaveRegistration} className="space-y-4 sm:space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">LANGKAH 1 DARI 2</span>
                    <h3 className="text-base font-bold text-slate-900">Data Peserta Anak</h3>
                  </div>

                  {/* FIELD 1: Nama Lengkap Anak */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama Lengkap Anak <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={childData.namaAnak}
                      onChange={(e) => setChildData({ ...childData, namaAnak: e.target.value })}
                      placeholder="e.g. Helmi"
                      className="w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:bg-white transition-all font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>

                  {/* FIELD 2: DROPDOWN CUSTOM TINGKATAN SEKOLAH DENGAN ANIMASI CASCADE & ICON LINE */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tingkatan Sekolah <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] hover:bg-slate-100/80 border ${
                          isDropdownOpen ? 'border-[#9EEA38] ring-2 ring-[#A3E635]/30 bg-white' : 'border-slate-200'
                        } rounded-2xl font-normal text-slate-800 flex items-center justify-between transition-all cursor-pointer`}
                      >
                        {selectedGroupObj ? (
                          <div className="flex items-center gap-2.5">
                            {renderGroupIcon(selectedGroupObj.id, "w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0 stroke-[1.75]")}
                            <span className="font-normal text-slate-900">{selectedGroupObj.label}</span>
                          </div>
                        ) : (
                          <span className="font-normal text-slate-400">-- Pilih Tingkatan Sekolah --</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-slate-700' : ''}`} />
                      </button>

                      {/* DROPDOWN POPUP MENU WITH CASCADE ANIMATION */}
                      {isDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />

                          <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.2),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                            {AGE_GROUPS.map((group, index) => {
                              const isSelected = childData.tingkatanId === group.id;
                              return (
                                <button
                                  key={group.id}
                                  type="button"
                                  style={{ animationDelay: `${index * 35}ms` }}
                                  onClick={() => handleSelectTingkatan(group.id)}
                                  className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm text-left flex items-center justify-between transition-all cursor-pointer animate-in fade-in-0 slide-in-from-top-1 duration-200 ${
                                    isSelected
                                      ? 'bg-[#F2FDE4] font-medium text-slate-950 border border-[#9EEA38]/80'
                                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-950 font-normal'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {renderGroupIcon(group.id, `w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[1.75] ${isSelected ? 'text-slate-950' : 'text-slate-500'}`)}
                                    <span className="font-normal text-xs sm:text-sm">{group.label}</span>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-emerald-700 stroke-[2.5] shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* FIELD 3: CABANG LOMBA */}
                  <div className="pt-2 space-y-3">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Cabang Lomba Diikuti <span className="text-rose-500">*</span>
                    </label>

                    {!childData.tingkatanId ? (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                        <AlertCircle className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                        Silakan pilih <b>Tingkatan Sekolah</b> di atas untuk membuka daftar pilihan lomba.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* List Ketangkasan */}
                        {activeSelectedCategoryObj?.dexterityList.map((item, idx) => {
                          const isChecked = childData.selectedLomba.includes(item);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleChildLomba(item)}
                              className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${
                                isChecked
                                  ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                  : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                  isChecked ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                                }`}>
                                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <span className="font-normal">{item}</span>
                              </div>
                            </button>
                          );
                        })}

                        {/* Mewarnai */}
                        {activeSelectedCategoryObj?.coloringCat && (
                          <button
                            type="button"
                            onClick={() => toggleChildLomba(activeSelectedCategoryObj.coloringCat!)}
                            className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${
                              childData.selectedLomba.includes(activeSelectedCategoryObj.coloringCat)
                                ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                childData.selectedLomba.includes(activeSelectedCategoryObj.coloringCat) ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                              }`}>
                                {childData.selectedLomba.includes(activeSelectedCategoryObj.coloringCat) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className="font-normal">{activeSelectedCategoryObj.coloringCat}</span>
                            </div>
                          </button>
                        )}

                        {/* Fashion Show */}
                        {activeSelectedCategoryObj?.fashionCat && (
                          <button
                            type="button"
                            onClick={() => toggleChildLomba(activeSelectedCategoryObj.fashionCat!)}
                            className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${
                              childData.selectedLomba.includes(activeSelectedCategoryObj.fashionCat)
                                ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                childData.selectedLomba.includes(activeSelectedCategoryObj.fashionCat) ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                              }`}>
                                {childData.selectedLomba.includes(activeSelectedCategoryObj.fashionCat) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className="font-normal">{activeSelectedCategoryObj.fashionCat}</span>
                            </div>
                          </button>
                        )}

                        {/* Parade Sepeda */}
                        <button
                          type="button"
                          onClick={() => toggleChildLomba('Parade Sepeda Hias (Minggu, 16 Ags)')}
                          className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${
                            childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)')
                              ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                              : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)') ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                            }`}>
                              {childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="font-normal">Parade Sepeda Hias (Minggu, 16 Ags)</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FIELD 4: Kontak Orang Tua & Rumah */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Blok / No. Rumah <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={childData.blokRumah}
                        onChange={(e) => setChildData({ ...childData, blokRumah: e.target.value })}
                        placeholder="B9 No. 12"
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Orang Tua <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="text"
                        value={childData.namaOrangTua}
                        onChange={(e) => setChildData({ ...childData, namaOrangTua: e.target.value })}
                        placeholder="Ayah / Ibu"
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="tel"
                        value={childData.whatsapp}
                        onChange={(e) => setChildData({ ...childData, whatsapp: e.target.value })}
                        placeholder="0812xxxxxxx"
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Kirim Pendaftaran Anak
                  </button>
                </form>
              )}

              {/* 2. FORM DEWASA & PASUTRI */}
              {formType === 'adults' && (
                <form onSubmit={handleSaveRegistration} className="space-y-4 sm:space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">FORM DEWASA</span>
                    <h3 className="text-base font-bold text-slate-900">Pendaftaran Lomba Dewasa & Pasutri</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Nama Peserta / Pasangan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adultData.namaPeserta}
                        onChange={(e) => setAdultData({ ...adultData, namaPeserta: e.target.value })}
                        placeholder="e.g. Pak Hendra & Bu Ani / Pak Budi"
                        className="w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Blok / Rumah <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adultData.blokRumah}
                        onChange={(e) => setAdultData({ ...adultData, blokRumah: e.target.value })}
                        placeholder="B10 No. 5"
                        className="w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pilih Perlombaan <span className="text-rose-500">*</span>
                    </label>

                    {ADULT_GROUPS.map((group, idx) => (
                      <div key={idx} className="bg-[#F8F9FA] p-3 sm:p-3.5 rounded-2xl border border-slate-200/60 space-y-2">
                        <h4 className="text-xs font-bold text-slate-700">{group.title}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.items.map((item, itemIdx) => {
                            const isChecked = adultData.selectedLomba.includes(item);
                            return (
                              <button
                                key={itemIdx}
                                type="button"
                                onClick={() => toggleAdultLomba(item)}
                                className={`p-3 rounded-xl border text-xs font-normal flex items-center justify-between transition-all cursor-pointer text-left ${
                                  isChecked
                                    ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                    isChecked ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="font-normal">{item}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="tel"
                      value={adultData.whatsapp}
                      onChange={(e) => setAdultData({ ...adultData, whatsapp: e.target.value })}
                      placeholder="0812xxxxxxx"
                      className="w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Kirim Pendaftaran Dewasa
                  </button>
                </form>
              )}

              {/* 3. FORM PENGISI ACARA / MC */}
              {formType === 'performers' && (
                <form onSubmit={handleSaveRegistration} className="space-y-4 sm:space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">OPEN REGISTRASI</span>
                    <h3 className="text-base font-bold text-slate-900">Pengisi Acara / MC Malam Puncak (17 Ags)</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama Penampil / MC / Kelompok <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={performerData.namaPenampil}
                      onChange={(e) => setPerformerData({ ...performerData, namaPenampil: e.target.value })}
                      placeholder="e.g. Sanggar Tari Mizu / Andi Vocalist / MC Bu Anita"
                      className="w-full px-4 py-3 text-base sm:text-sm bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jenis Penampilan</label>
                      <select
                        value={performerData.jenisPenampilan}
                        onChange={(e) => setPerformerData({ ...performerData, jenisPenampilan: e.target.value })}
                        className="w-full px-3 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none cursor-pointer font-normal text-slate-800"
                      >
                        <option value="MC / Pembawa Acara">MC / Pembawa Acara</option>
                        <option value="Menyanyi">Menyanyi</option>
                        <option value="Menari">Menari</option>
                        <option value="Puisi/Drama">Puisi / Drama</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori</label>
                      <select
                        value={performerData.tipe}
                        onChange={(e) => setPerformerData({ ...performerData, tipe: e.target.value })}
                        className="w-full px-3 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none cursor-pointer font-normal text-slate-800"
                      >
                        <option value="Individu">Individu (Solo)</option>
                        <option value="Kelompok">Kelompok / Grup</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jumlah Anggota</label>
                      <input
                        type="number"
                        min="1"
                        value={performerData.jumlahOrang}
                        onChange={(e) => setPerformerData({ ...performerData, jumlahOrang: e.target.value })}
                        className="w-full px-3 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Blok / Rumah <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={performerData.blokRumah}
                        onChange={(e) => setPerformerData({ ...performerData, blokRumah: e.target.value })}
                        placeholder="B9 No. 3"
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="tel"
                        value={performerData.whatsapp}
                        onChange={(e) => setPerformerData({ ...performerData, whatsapp: e.target.value })}
                        placeholder="0812xxxxxxx"
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-xl focus:outline-none font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Daftar Pengisi Acara / MC
                  </button>
                </form>
              )}

            </div>

            {/* CARE TEAM SECTION */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Panitia Pendaftaran (Care Team)</h3>
              <p className="text-xs text-slate-500">Ada pertanyaan? Silakan hubungi tim panitia kami:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CARE_TEAM.map((ct, idx) => (
                  <a
                    key={idx}
                    href={`https://wa.me/62${ct.phone.slice(1)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-[#F8F9FA] hover:bg-[#F2FDE4] border border-slate-200/60 rounded-2xl flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{ct.avatar}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-950">{ct.name}</p>
                        <p className="text-[10px] text-slate-500">{ct.role}</p>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-[#83DF22] group-hover:border-[#83DF22] group-hover:text-slate-950 transition-colors shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DAFTAR PESERTA & EKSPOR DATA (PROTECTED FOR ADMIN) */}
        {activeTab === 'participants' && isAdminUnlocked && (
          <div className="space-y-4">
            <div className="bg-white p-4 border border-slate-200/80 rounded-3xl shadow-2xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, kode reg, blok rumah..."
                  className="w-full pl-10 pr-4 py-2.5 text-base sm:text-xs bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] font-normal text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-600">Total: {filteredParticipants.length} Peserta</span>
                
                <div className="flex gap-2">
                  <button
                    onClick={exportToExcel}
                    className="px-2.5 sm:px-3 py-1.5 bg-[#EAFCD7] hover:bg-[#DCF9BF] border border-[#BCE88C] text-emerald-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Excel (.csv)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" /> Cetak PDF
                  </button>
                </div>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Belum ada data peserta pendaftaran.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredParticipants.map((p) => (
                  <div key={p.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-[#BCE88C] transition-all space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-extrabold text-emerald-700 bg-[#E8FCD0] px-2 py-0.5 rounded-md">
                          {p.code}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">
                          {p.namaPeserta} {p.umur && <span className="text-xs text-slate-500 font-normal">({p.umur} Thn)</span>}
                        </h4>
                      </div>
                      <button
                        onClick={() => setDeleteModalId(p.id)}
                        className="print:hidden p-1 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-[#F8F9FA] p-2.5 rounded-xl">
                      <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">{p.type} • {p.kategoriGroup}</p>
                      <ul className="list-disc list-inside text-slate-700 font-medium space-y-0.5">
                        {p.lomba?.map((l, i) => <li key={i} className="truncate">{l}</li>)}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Ortu: {p.namaOrangTua || '-'} | WA: {p.whatsapp}</span>
                      <span className="font-semibold text-slate-700">Blok: {p.blokRumah}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Agenda Perlombaan Seion 2026</h3>
            
            <div className="space-y-3 text-xs">
              <div className="p-3.5 sm:p-4 bg-[#F8F9FA] border border-slate-200/80 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Minggu, 9 Agustus 2026</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-semibold text-[10px]">Hari 1</span>
                </div>
                <p className="text-slate-600">🎯 Lomba Ketangkasan Anak (Kolam Mizu & B9–B10)</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-[#F8F9FA] border border-slate-200/80 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Sabtu, 15 Agustus 2026</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-semibold text-[10px]">Hari 2</span>
                </div>
                <p className="text-slate-600">🎨 Lomba Mewarnai Anak-Anak (Playgroup, TK, SD 1-3, SD 4-6)</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-[#F8F9FA] border border-slate-200/80 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Minggu, 16 Agustus 2026</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-semibold text-[10px]">Hari 3</span>
                </div>
                <p className="text-slate-600">🚲 Parade Sepeda Hias, Jalan Santai, Pasutri, Bapak-Bapak & Ibu-Ibu</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-[#F2FDE4] border border-[#9EEA38] rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-950">Senin, 17 Agustus 2026</span>
                  <span className="px-2 py-0.5 bg-[#83DF22] text-slate-950 rounded-full font-extrabold text-[10px]">Malam Puncak</span>
                </div>
                <p className="text-slate-800 font-medium">⭐ Panggung Utama: Fashion Show Nusantara & Penampilan Pengisi Acara</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FLOATING BOTTOM NAV BAR */}
      <nav className="print:hidden fixed bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-full px-2 py-1.5 z-40 flex items-center justify-between gap-1 w-[94%] max-w-sm sm:w-auto sm:px-3 sm:py-2 sm:gap-2">
        <button
          onClick={() => handleTabClick('register')}
          className={`flex-1 sm:flex-initial justify-center px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'register'
              ? 'bg-slate-900 text-[#D2F54E] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span>Home</span>
        </button>

        <button
          onClick={() => handleTabClick('participants')}
          className={`flex-1 sm:flex-initial justify-center px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'participants'
              ? 'bg-slate-900 text-[#D2F54E] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>{isAdminUnlocked ? `Peserta (${participants.length})` : 'Peserta 🔒'}</span>
        </button>

        <button
          onClick={() => handleTabClick('schedule')}
          className={`flex-1 sm:flex-initial justify-center px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-slate-900 text-[#D2F54E] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Jadwal</span>
        </button>
      </nav>

      {/* MODAL PIN ADMIN PROTECTION */}
      {showPinModal && (
        <div className="print:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-[92vw] sm:max-w-sm rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => {
                setShowPinModal(false);
                setPinInput('');
                setPinError('');
              }}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1.5 pt-2">
              <div className="w-12 h-12 bg-[#F2FDE4] border border-[#9EEA38] text-slate-950 rounded-full flex items-center justify-center mx-auto mb-2 shadow-2xs">
                <Lock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Akses Khusus Admin</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Masukkan Kode PIN Admin (4 Digit) untuk membuka rekap data peserta pendaftaran.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center mb-2">
                  PIN Admin
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  required
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="• • • •"
                  className="w-full text-center tracking-[1em] text-2xl font-mono font-normal py-3.5 bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:bg-white transition-all text-slate-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-normal"
                />
              </div>

              {pinError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" /> Masuk Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUKTI PENDAFTARAN DIGITAL */}
      {ticketModal && (
        <div className="print:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-[92vw] sm:max-w-sm rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-[#E8FCD0] border border-[#BCE88C] text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-1">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Pendaftaran Berhasil!</h3>
              <p className="text-xs text-slate-500">Tiket Pendaftaran Digital Seion</p>
            </div>

            <div className="p-3 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Kode Registrasi</span>
              <p className="font-mono text-xl font-bold text-slate-900 tracking-wider my-0.5">{ticketModal.code}</p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 border-t border-b border-slate-100 py-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Nama Peserta:</span>
                <span className="font-bold text-slate-900">{ticketModal.namaPeserta}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kategori / Tingkatan:</span>
                <span className="font-medium">{ticketModal.kategoriGroup}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 block mb-0.5">Lomba:</span>
                <ul className="list-disc list-inside font-semibold text-slate-800 space-y-0.5">
                  {ticketModal.lomba?.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            </div>

            <div className="print:hidden flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak
              </button>
              <button
                onClick={() => {
                  setTicketModal(null);
                  if (isAdminUnlocked) {
                    setActiveTab('participants');
                  }
                }}
                className="flex-1 py-3 bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-1 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteModalId && (
        <div className="print:hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-[85vw] sm:max-w-xs rounded-3xl p-5 space-y-4 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Hapus Pendaftaran?</h3>
              <p className="text-xs text-slate-500 mt-1">Data pendaftaran ini akan dihapus dari sistem.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModalId(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs rounded-xl font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 text-white text-xs rounded-xl font-bold cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
