'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Search, Filter, Download,
  Trash2, Printer, FileSpreadsheet, Phone,
  Check, ChevronDown, Users, AlertCircle, RefreshCw,
  Clock, Home, X, CheckCircle2, Lock, KeyRound, ShieldCheck,
  Baby, Sparkles, BookOpen, Trophy, GraduationCap, User,
  FileText, Layers
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db, appId } from '@/lib/firebase';
import {
  AGE_GROUPS,
  ADULT_GROUPS,
  CARE_TEAM,
  RegistrationParticipant
} from '@/data/masterData';

const cascadeContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.01
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.08,
      ease: 'easeOut'
    }
  }
};

const cascadeItemVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 10, 
    filter: 'blur(6px)'
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: {
      type: 'tween',
      ease: [0.16, 1, 0.3, 1],
      duration: 0.28
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.06
    }
  }
};

const dropdownMenuVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: -6,
    transition: {
      duration: 0.1,
      ease: 'easeOut'
    }
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 26,
      mass: 0.6,
      staggerChildren: 0.035,
      delayChildren: 0.01
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: {
      duration: 0.08,
      ease: 'easeIn'
    }
  }
};

const dropdownItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
    filter: 'blur(3px)'
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'tween',
      ease: [0.16, 1, 0.3, 1],
      duration: 0.2
    }
  }
};

export default function RegistrationPlatform() {
  const [activeTab, setActiveTab] = useState<'register' | 'participants' | 'schedule'>('register');
  const [formType, setFormType] = useState<'children' | 'adults' | 'performers'>('children');

  // Firebase State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [participants, setParticipants] = useState<RegistrationParticipant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [ticketModal, setTicketModal] = useState<RegistrationParticipant | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

  // Admin Security State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('seion_admin_unlocked') === 'true';
    }
    return false;
  });
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isJenisPenampilanOpen, setIsJenisPenampilanOpen] = useState(false);
  const [isKategoriPerformerOpen, setIsKategoriPerformerOpen] = useState(false);

  // Export & Filter State
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [groupingMode, setGroupingMode] = useState<'default' | 'blok' | 'lomba'>('default');
  const [pdfFormat, setPdfFormat] = useState<'general' | 'grouping'>('general');

  // Infinite Scroll State
  const ITEMS_PER_BATCH = 10;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const triggerPdfPrint = (format: 'general' | 'grouping') => {
    setPdfFormat(format);
    setExportMenuOpen(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Helper to group participants for Grouping PDF export
  const getGroupedPdfData = () => {
    const childrenMap: { [lombaName: string]: RegistrationParticipant[] } = {};
    const adultMap: { [lombaName: string]: RegistrationParticipant[] } = {};
    const performerMap: { [jenisPenampilan: string]: RegistrationParticipant[] } = {};

    const expandedList = expandParticipantsForDisplay(filteredParticipants);

    expandedList.forEach(p => {
      if (p.type === 'Pengisi Acara') {
        const rawJenis = p.lomba && p.lomba.length > 0 ? p.lomba[0] : 'Pengisi Acara';
        const jenis = cleanLombaTitle(rawJenis);
        if (!performerMap[jenis]) performerMap[jenis] = [];
        if (!performerMap[jenis].some(existing => existing.id === p.id)) {
          performerMap[jenis].push(p);
        }
      } else if (p.type === 'Dewasa & Pasutri' || p.kategoriGroup?.includes('Dewasa') || p.kategoriGroup?.includes('Bapak') || p.kategoriGroup?.includes('Ibu') || p.kategoriGroup?.includes('Pasutri')) {
        if (p.lomba && p.lomba.length > 0) {
          p.lomba.forEach(lName => {
            const clean = cleanLombaTitle(lName);
            if (!adultMap[clean]) adultMap[clean] = [];
            if (!adultMap[clean].some(existing => existing.id === p.id)) {
              adultMap[clean].push(p);
            }
          });
        } else {
          const fallbackKey = cleanLombaTitle(p.kategoriGroup || 'Dewasa');
          if (!adultMap[fallbackKey]) adultMap[fallbackKey] = [];
          if (!adultMap[fallbackKey].some(existing => existing.id === p.id)) {
            adultMap[fallbackKey].push(p);
          }
        }
      } else {
        // Anak / Remaja
        if (p.lomba && p.lomba.length > 0) {
          p.lomba.forEach(lName => {
            const clean = cleanLombaTitle(lName);
            if (!childrenMap[clean]) childrenMap[clean] = [];
            if (!childrenMap[clean].some(existing => existing.id === p.id)) {
              childrenMap[clean].push(p);
            }
          });
        } else {
          const fallbackKey = cleanLombaTitle(p.kategoriGroup || 'Anak & Remaja');
          if (!childrenMap[fallbackKey]) childrenMap[fallbackKey] = [];
          if (!childrenMap[fallbackKey].some(existing => existing.id === p.id)) {
            childrenMap[fallbackKey].push(p);
          }
        }
      }
    });

    return { childrenMap, adultMap, performerMap };
  };

  // House Number Modal & Global State
  const [isHouseModalOpen, setIsHouseModalOpen] = useState(false);
  const [houseModalMode, setHouseModalMode] = useState<'welcome' | 'edit'>('welcome');
  const [selectedBlokPrefix, setSelectedBlokPrefix] = useState<'B' | 'C' | ''>('B');
  const [subBlokInput, setSubBlokInput] = useState('');
  const [noRumahInput, setNoRumahInput] = useState('');
  const [globalHouseBlock, setGlobalHouseBlock] = useState('');

  // Form State - Anak (Umur dihapus)
  const [childData, setChildData] = useState({
    namaAnak: '',
    tingkatanId: '',
    selectedLomba: [] as string[],
    namaOrangTua: '',
    whatsapp: '',
    blokRumah: ''
  });

  // Form State - Dewasa / Pasutri
  const [adultData, setAdultData] = useState({
    blokRumah: '',
    namaPeserta: '',
    role: 'Bapak Bapak' as 'Bapak Bapak' | 'Ibu-Ibu',
    hasSpouse: false,
    namaPasangan: '',
    selectedLomba: [] as string[],
    whatsapp: ''
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

  // Check saved House Block on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHouse = localStorage.getItem('seion_user_house_block');
      if (savedHouse) {
        setGlobalHouseBlock(savedHouse);
        setChildData(prev => ({ ...prev, blokRumah: savedHouse }));
        setAdultData(prev => ({ ...prev, blokRumah: savedHouse }));
        setPerformerData(prev => ({ ...prev, blokRumah: savedHouse }));
      } else {
        setIsHouseModalOpen(true);
        setHouseModalMode('welcome');
      }
    }
  }, []);

  const openEditHouseModal = () => {
    if (globalHouseBlock) {
      const match = globalHouseBlock.match(/^([BC])(\d+)\s*\/\s*(\d+)$/i);
      if (match) {
        setSelectedBlokPrefix(match[1].toUpperCase() as 'B' | 'C');
        setSubBlokInput(match[2]);
        setNoRumahInput(match[3]);
      }
    }
    setHouseModalMode('edit');
    setIsHouseModalOpen(true);
  };

  const handleSaveHouseBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlokPrefix) {
      alert("Pilih Blok (B atau C)!");
      return;
    }
    if (!subBlokInput.trim() || !noRumahInput.trim()) {
      alert("Lengkapi nomor blok dan nomor rumah!");
      return;
    }

    const formatted = `${selectedBlokPrefix}${subBlokInput.trim()} / ${noRumahInput.trim()}`;
    setGlobalHouseBlock(formatted);
    if (typeof window !== 'undefined') {
      localStorage.setItem('seion_user_house_block', formatted);
    }

    // Sync form states
    setChildData(prev => ({ ...prev, blokRumah: formatted }));
    setAdultData(prev => ({ ...prev, blokRumah: formatted }));
    setPerformerData(prev => ({ ...prev, blokRumah: formatted }));

    setIsHouseModalOpen(false);
  };

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
      setIsShaking(true);
      setPinError('PIN Salah! Kode akses yang Anda masukkan tidak cocok.');
      setPinInput('');
      setTimeout(() => setIsShaking(false), 500);
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

    const effectiveHouseBlock = globalHouseBlock.trim() || (typeof window !== 'undefined' ? localStorage.getItem('seion_user_house_block') || '' : '');
    if (!effectiveHouseBlock) {
      setLoading(false);
      setHouseModalMode('welcome');
      setIsHouseModalOpen(true);
      alert("Silakan isi Blok & Nomor Rumah terlebih dahulu!");
      return;
    }

    const code = 'SEION-' + Math.floor(10000 + Math.random() * 90000);
    const payloadsToSave: Omit<RegistrationParticipant, 'id'>[] = [];

    if (formType === 'children') {
      if (!childData.namaAnak.trim()) { alert("Nama anak wajib diisi!"); setLoading(false); return; }
      if (!childData.tingkatanId) { alert("Tingkatan sekolah wajib dipilih!"); setLoading(false); return; }
      if (childData.selectedLomba.length === 0) { alert("Pilih minimal 1 lomba!"); setLoading(false); return; }

      const selectedCatObj = AGE_GROUPS.find(g => g.id === childData.tingkatanId);

      payloadsToSave.push({
        type: 'Anak / Remaja',
        namaPeserta: childData.namaAnak.trim(),
        kategoriGroup: selectedCatObj ? selectedCatObj.label : 'Anak-Anak',
        lomba: childData.selectedLomba,
        namaOrangTua: childData.namaOrangTua.trim() || '-',
        whatsapp: childData.whatsapp.trim() || '-',
        blokRumah: effectiveHouseBlock,
        code: code,
        createdAt: serverTimestamp()
      });
    } else if (formType === 'adults') {
      if (!adultData.namaPeserta.trim()) { alert("Nama lengkap wajib diisi!"); setLoading(false); return; }
      if (adultData.hasSpouse && !adultData.namaPasangan.trim()) {
        const spouseLabel = adultData.role === 'Ibu-Ibu' ? 'Suami' : 'Istri';
        alert(`Nama lengkap ${spouseLabel} wajib diisi!`);
        setLoading(false);
        return;
      }
      if (adultData.selectedLomba.length === 0) { alert("Pilih minimal 1 lomba!"); setLoading(false); return; }

      if (adultData.hasSpouse) {
        const pasutriLomba: string[] = [];
        const bapakLomba: string[] = [];
        const ibuLomba: string[] = [];

        const bapakName = adultData.role === 'Bapak Bapak' ? adultData.namaPeserta.trim() : adultData.namaPasangan.trim();
        const ibuName = adultData.role === 'Ibu-Ibu' ? adultData.namaPeserta.trim() : adultData.namaPasangan.trim();

        adultData.selectedLomba.forEach(l => {
          const clean = l.replace(' (Bapak-Bapak)', '').replace(' (Ibu-Ibu)', '');
          if (['Make Up Pasangan', 'Joget Balon Pasutri'].includes(clean)) {
            pasutriLomba.push(clean);
          } else if (['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].includes(clean)) {
            ibuLomba.push(clean);
          } else if (['Tendangan Penalti', 'Lempar Bola Pakai Sarung'].includes(clean)) {
            if (l.includes('Ibu-Ibu')) {
              ibuLomba.push(clean);
            } else {
              bapakLomba.push(clean);
            }
          }
        });

        // 1. Pasutri Record
        if (pasutriLomba.length > 0) {
          payloadsToSave.push({
            type: 'Dewasa / Pasutri',
            namaPeserta: `Pasutri (${bapakName} & ${ibuName})`,
            role: 'Pasutri',
            hasSpouse: true,
            namaPasangan: '-',
            kategoriGroup: 'Lomba Pasutri',
            lomba: pasutriLomba,
            whatsapp: adultData.whatsapp.trim() || '-',
            blokRumah: effectiveHouseBlock,
            code: `${code}-P`,
            createdAt: serverTimestamp()
          });
        }

        // 2. Bapak Record
        if (bapakLomba.length > 0) {
          payloadsToSave.push({
            type: 'Dewasa (Perorangan)',
            namaPeserta: bapakName,
            role: 'Bapak Bapak',
            hasSpouse: true,
            namaPasangan: ibuName,
            kategoriGroup: 'Lomba Bapak-Bapak',
            lomba: bapakLomba,
            whatsapp: adultData.whatsapp.trim() || '-',
            blokRumah: effectiveHouseBlock,
            code: `${code}-B`,
            createdAt: serverTimestamp()
          });
        }

        // 3. Ibu Record
        if (ibuLomba.length > 0) {
          payloadsToSave.push({
            type: 'Dewasa (Perorangan)',
            namaPeserta: ibuName,
            role: 'Ibu-Ibu',
            hasSpouse: true,
            namaPasangan: bapakName,
            kategoriGroup: 'Lomba Ibu-Ibu',
            lomba: ibuLomba,
            whatsapp: adultData.whatsapp.trim() || '-',
            blokRumah: effectiveHouseBlock,
            code: `${code}-I`,
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Single Bapak or Single Ibu
        const cleanLombaList = adultData.selectedLomba.map(l => l.replace(' (Bapak-Bapak)', '').replace(' (Ibu-Ibu)', ''));
        payloadsToSave.push({
          type: 'Dewasa (Perorangan)',
          namaPeserta: adultData.namaPeserta.trim(),
          role: adultData.role,
          hasSpouse: false,
          namaPasangan: '-',
          kategoriGroup: `Dewasa (${adultData.role})`,
          lomba: cleanLombaList,
          whatsapp: adultData.whatsapp.trim() || '-',
          blokRumah: effectiveHouseBlock,
          code: code,
          createdAt: serverTimestamp()
        });
      }
    } else if (formType === 'performers') {
      if (!performerData.namaPenampil.trim()) { alert("Nama penampil wajib diisi!"); setLoading(false); return; }

      payloadsToSave.push({
        type: 'Pengisi Acara (Malam Puncak)',
        namaPeserta: performerData.namaPenampil.trim(),
        kategoriGroup: `Pengisi Acara (${performerData.jenisPenampilan})`,
        lomba: [`Pengisi Acara: ${performerData.jenisPenampilan} (${performerData.tipe} - ${performerData.jumlahOrang} Orang)`],
        whatsapp: performerData.whatsapp.trim() || '-',
        blokRumah: effectiveHouseBlock,
        code: code,
        createdAt: serverTimestamp()
      });
    }

    if (payloadsToSave.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const savedDocs: RegistrationParticipant[] = [];
      if (user) {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
        for (const p of payloadsToSave) {
          const docRef = await addDoc(colRef, p);
          savedDocs.push({ id: docRef.id, ...p });
        }
      } else {
        payloadsToSave.forEach((p, idx) => {
          savedDocs.push({ id: 'local-' + Date.now() + '-' + idx, ...p });
        });
      }

      setParticipants(prev => [...savedDocs, ...prev]);

      // Set ticket modal view with combined summary doc
      const summaryLomba = payloadsToSave.flatMap(p => p.lomba);
      const ticketDoc: RegistrationParticipant = {
        id: savedDocs[0].id,
        code: code,
        type: adultData.hasSpouse ? 'Dewasa / Pasutri' : payloadsToSave[0].type,
        namaPeserta: adultData.hasSpouse ? `${adultData.namaPeserta} & ${adultData.namaPasangan}` : payloadsToSave[0].namaPeserta,
        namaPasangan: adultData.hasSpouse ? adultData.namaPasangan : undefined,
        role: adultData.role,
        kategoriGroup: adultData.hasSpouse ? `Pasutri (${adultData.namaPeserta} & ${adultData.namaPasangan})` : payloadsToSave[0].kategoriGroup,
        lomba: summaryLomba,
        whatsapp: payloadsToSave[0].whatsapp,
        blokRumah: payloadsToSave[0].blokRumah
      };
      setTicketModal(ticketDoc);

      // Reset Forms
      setChildData({ namaAnak: '', tingkatanId: '', selectedLomba: [], namaOrangTua: '', whatsapp: '', blokRumah: '' });
      setAdultData({ blokRumah: '', namaPeserta: '', role: 'Bapak Bapak', hasSpouse: false, namaPasangan: '', selectedLomba: [], whatsapp: '' });
      setPerformerData({ namaPenampil: '', jenisPenampilan: 'Menyanyi', tipe: 'Individu', jumlahOrang: '1', whatsapp: '', blokRumah: '' });
    } catch (err) {
      console.warn("Save warning fallback to local storage:", err);
      const mockDocs: RegistrationParticipant[] = payloadsToSave.map((p, idx) => ({ id: 'local-' + Date.now() + '-' + idx, ...p }));
      setParticipants(prev => [...mockDocs, ...prev]);
      setTicketModal(mockDocs[0]);
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

  // Helper function to categorize adult lomba items by participant (Pasutri, Bapak, Ibu)
  const categorizeLombaForDisplay = (lombaList: string[], role?: string, mainName?: string, spouseName?: string) => {
    const pasutri: string[] = [];
    const bapak: string[] = [];
    const ibu: string[] = [];
    const general: string[] = [];

    const bapakName = role === 'Bapak Bapak' ? (mainName || 'Bapak') : (spouseName || 'Suami');
    const ibuName = role === 'Ibu-Ibu' ? (mainName || 'Ibu') : (spouseName || 'Istri');

    (lombaList || []).forEach(l => {
      const clean = l.replace(' (Bapak-Bapak)', '').replace(' (Ibu-Ibu)', '');
      if (['Make Up Pasangan', 'Joget Balon Pasutri'].includes(clean)) {
        pasutri.push(clean);
      } else if (['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].includes(clean)) {
        ibu.push(clean);
      } else if (['Tendangan Penalti', 'Lempar Bola Pakai Sarung'].includes(clean)) {
        if (l.includes('Ibu-Ibu')) {
          ibu.push(clean);
        } else {
          bapak.push(clean);
        }
      } else {
        general.push(clean);
      }
    });

    return { pasutri, bapak, ibu, general, bapakName, ibuName };
  };

  // Helper to expand any legacy/combined Pasutri record into 3 separate display records
  const expandParticipantsForDisplay = (list: RegistrationParticipant[]): RegistrationParticipant[] => {
    const expanded: RegistrationParticipant[] = [];

    list.forEach(p => {
      if (p.hasSpouse && p.lomba && p.lomba.length > 1 && (p.type === 'Dewasa / Pasutri' || p.kategoriGroup?.includes('Pasutri'))) {
        const pasutriLomba: string[] = [];
        const bapakLomba: string[] = [];
        const ibuLomba: string[] = [];

        const bapakName = p.role === 'Bapak Bapak' ? (p.namaPeserta || 'Bapak') : (p.namaPasangan || 'Suami');
        const ibuName = p.role === 'Ibu-Ibu' ? (p.namaPeserta || 'Ibu') : (p.namaPasangan || 'Istri');

        p.lomba.forEach(l => {
          const clean = l.replace(' (Bapak-Bapak)', '').replace(' (Ibu-Ibu)', '');
          if (['Make Up Pasangan', 'Joget Balon Pasutri'].includes(clean)) {
            pasutriLomba.push(clean);
          } else if (['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].includes(clean)) {
            ibuLomba.push(clean);
          } else if (['Tendangan Penalti', 'Lempar Bola Pakai Sarung'].includes(clean)) {
            if (l.includes('Ibu-Ibu')) {
              ibuLomba.push(clean);
            } else {
              bapakLomba.push(clean);
            }
          }
        });

        const activeCatCount = [pasutriLomba.length > 0, bapakLomba.length > 0, ibuLomba.length > 0].filter(Boolean).length;

        if (activeCatCount > 1) {
          if (pasutriLomba.length > 0) {
            expanded.push({
              ...p,
              id: `${p.id}-P`,
              code: p.code ? `${p.code}-P` : p.code,
              namaPeserta: `Pasutri (${bapakName} & ${ibuName})`,
              namaPasangan: '-',
              role: 'Pasutri',
              kategoriGroup: 'Lomba Pasutri',
              lomba: pasutriLomba
            });
          }
          if (bapakLomba.length > 0) {
            expanded.push({
              ...p,
              id: `${p.id}-B`,
              code: p.code ? `${p.code}-B` : p.code,
              namaPeserta: bapakName,
              namaPasangan: ibuName,
              role: 'Bapak Bapak',
              kategoriGroup: 'Lomba Bapak-Bapak',
              lomba: bapakLomba
            });
          }
          if (ibuLomba.length > 0) {
            expanded.push({
              ...p,
              id: `${p.id}-I`,
              code: p.code ? `${p.code}-I` : p.code,
              namaPeserta: ibuName,
              namaPasangan: bapakName,
              role: 'Ibu-Ibu',
              kategoriGroup: 'Lomba Ibu-Ibu',
              lomba: ibuLomba
            });
          }
          return;
        }
      }

      expanded.push(p);
    });

    return expanded;
  };

  // AUDITED & REFINED EXCEL / CSV EXPORT
  const exportToExcel = () => {
    const listToExport = expandParticipantsForDisplay(filteredParticipants);
    if (listToExport.length === 0) {
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
    csvLines.push(`"HUT RI Ke-81 Cluster Mizu & B9-B10 (Format Grouping Lomba)"`);
    csvLines.push(`"Tanggal Ekspor: ${todayStr} | Total Registrasi: ${filteredParticipants.length} Data"`);
    csvLines.push('');

    // Group expanded participants by clean lomba title
    const lombaMap: { [cleanTitle: string]: RegistrationParticipant[] } = {};

    listToExport.forEach(p => {
      const list = (p.lomba && p.lomba.length > 0) ? p.lomba : ['Lainnya'];
      list.forEach(rawTitle => {
        const cleanTitle = cleanLombaTitle(rawTitle);
        if (!lombaMap[cleanTitle]) lombaMap[cleanTitle] = [];
        if (!lombaMap[cleanTitle].some(existing => existing.id === p.id)) {
          lombaMap[cleanTitle].push(p);
        }
      });
    });

    const sortedLombaKeys = Object.keys(lombaMap).sort((a, b) => {
      const priorityA = getLombaPriority(a);
      const priorityB = getLombaPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });

    sortedLombaKeys.forEach((lombaTitle) => {
      const plist = lombaMap[lombaTitle];
      if (plist.length === 0) return;

      csvLines.push(`"============================================================"`);
      csvLines.push(`"🎯 LOMBA / ACARA: ${lombaTitle.toUpperCase()} (${plist.length} Peserta)"`);
      csvLines.push(`"============================================================"`);
      
      const headers = [
        "No.",
        "Nama Peserta",
        "Nama Ortu / Pasangan",
        "Kategori",
        "Blok Rumah",
        "No. WhatsApp"
      ];
      csvLines.push(headers.map(h => `"${h}"`).join(','));

      plist.forEach((p, index) => {
        const parentOrSpouse = p.namaOrangTua && p.namaOrangTua !== '-'
          ? p.namaOrangTua
          : (p.namaPasangan && p.namaPasangan !== '-' ? p.namaPasangan : '-');

        const row = [
          index + 1,
          cleanField(p.namaPeserta || '-'),
          cleanField(parentOrSpouse),
          cleanField(p.kategoriGroup || p.type || '-'),
          cleanField(`Blok ${p.blokRumah}`),
          cleanPhone(p.whatsapp)
        ];
        csvLines.push(row.join(','));
      });

      csvLines.push(''); // Spacing line between lomba tables
    });

    const csvString = "\uFEFF" + csvLines.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_Peserta_Lomba_Seion_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Expanded & Filtered Participants
  const expandedParticipants = expandParticipantsForDisplay(participants);

  const filteredParticipants = expandedParticipants.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.namaPeserta?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.blokRumah?.toLowerCase().includes(q) ||
      (p.namaOrangTua && p.namaOrangTua !== '-' && p.namaOrangTua.toLowerCase().includes(q)) ||
      p.kategoriGroup?.toLowerCase().includes(q) ||
      p.lomba?.some(l => l.toLowerCase().includes(q))
    );
  });

  // Grouping by Blok Rumah
  const groupedByBlok = React.useMemo(() => {
    const map: { [key: string]: typeof filteredParticipants } = {};
    filteredParticipants.forEach(p => {
      const key = p.blokRumah || 'Lainnya';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return Object.keys(map).sort().map(key => ({
      blokKey: key,
      items: map[key]
    }));
  }, [filteredParticipants]);

  // Helper to strip out dates & role tags from lomba title for clean display
  const cleanLombaTitle = (title: string) => {
    if (!title) return '';
    return title
      .replace(/\s*\((Minggu|Senin|Sabtu|Jumat|Selasa|Rabu|Kamis),\s*\d+\s*Ags\)/gi, '')
      .replace(/\s*\(Bapak-Bapak\)/gi, '')
      .replace(/\s*\(Ibu-Ibu\)/gi, '')
      .trim();
  };

  // Priority mapping for chronological event schedule sorting
  const getLombaPriority = (title: string): number => {
    const clean = cleanLombaTitle(title);

    // 1. Lomba Ketangkasan Anak (Minggu, 9 Ags)
    if (clean.includes('Mencocokan Warna') || clean.includes('Spons')) return 10;
    if (clean.includes('Pindahkan Karet') || clean.includes('Pindahkan Air ke Botol')) return 11;
    if (clean.includes('Lari dengan Balon') || clean.includes('Pindahkan Air dengan Sedotan') || clean.includes('Estafet Gelas')) return 12;
    if (clean.includes('Sedotan ke Botol') || clean.includes('Tiup Bola') || clean.includes('Estafet Hanger')) return 13;
    if (clean.includes('Bola dari Kardus') || clean.includes('Gelas dengan Balon') || clean.includes('Bola Poli')) return 14;

    // 2. Lomba Mewarnai (Sabtu, 15 Ags)
    if (clean.includes('Mewarnai')) return 20;

    // 3. Lomba Parade Sepeda Hias (Minggu, 16 Ags)
    if (clean.includes('Parade Sepeda Hias')) return 30;

    // 4. Lomba Dewasa & Pasutri (Minggu, 16 Ags)
    if (clean.includes('Tendangan Penalti')) return 40;
    if (clean.includes('Lempar Bola')) return 41;
    if (clean.includes('Kepiting Air')) return 42;
    if (clean.includes('Balap Kelereng')) return 43;
    if (clean.includes('Make Up Pasangan')) return 44;
    if (clean.includes('Joget Balon')) return 45;

    // 5. Fashion Show Nusantara (Senin, 17 Ags)
    if (clean.includes('Fashion Show')) return 50;

    // 6. Pengisi Acara Malam Puncak (Senin, 17 Ags)
    if (clean.includes('Pengisi Acara')) return 60;

    return 99;
  };

  // Grouping by Lomba / Acara (Sorted Chronologically & Clean Title)
  const groupedByLomba = React.useMemo(() => {
    const map: { [cleanTitle: string]: typeof filteredParticipants } = {};
    filteredParticipants.forEach(p => {
      const list = (p.lomba && p.lomba.length > 0) ? p.lomba : ['Lainnya'];
      list.forEach(rawTitle => {
        const cleanTitle = cleanLombaTitle(rawTitle);
        if (!map[cleanTitle]) map[cleanTitle] = [];
        if (!map[cleanTitle].some(existing => existing.id === p.id)) {
          map[cleanTitle].push(p);
        }
      });
    });

    const sortedKeys = Object.keys(map).sort((a, b) => {
      const priorityA = getLombaPriority(a);
      const priorityB = getLombaPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({
      lombaKey: key,
      items: map[key]
    }));
  }, [filteredParticipants]);

  // Reset visible count whenever search query or grouping mode changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_BATCH);
  }, [searchQuery, groupingMode]);

  const visibleParticipants = filteredParticipants.slice(0, visibleCount);
  const hasMore = visibleCount < filteredParticipants.length;

  // Keep mutable refs so scroll handler always reads latest values without re-registering
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(hasMore);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // Reliable infinite scroll via window scroll — no DOM ref timing issues
  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
      if (nearBottom && !isLoadingMoreRef.current && hasMoreRef.current) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleCount(c => c + ITEMS_PER_BATCH);
          setIsLoadingMore(false);
        }, 500);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroupObj = AGE_GROUPS.find(g => g.id === childData.tingkatanId);
  const activeSelectedCategoryObj = selectedGroupObj;
  const formattedToday = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#FAFBF8] text-slate-800 font-sans antialiased selection:bg-[#D2F54E] selection:text-slate-900 pb-20">

      <style jsx global>{`
        @media screen {
          .print-only-container {
            display: none !important;
          }
        }
        @media print {
          .print-only-container {
            display: block !important;
          }
          body {
            background: white !important;
          }
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        .print-table th, .print-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }
        .print-table th {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #0f172a;
        }
      `}</style>

      {/* ---------------------------------------------------- */}
      {/* PRINT-ONLY OFFICIAL REPORT LAYOUT (HIDDEN ON SCREEN, VISIBLE ON PRINT/PDF) */}
      {/* ---------------------------------------------------- */}
      <div className="print-only-container hidden print:block w-full p-6">
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
            REKAP DAFTAR PESERTA LOMBA KEMERDEKAAN SEION 2026
          </h1>
          <p className="text-xs text-slate-600 font-bold mt-1">
            HUT RI Ke-81 Cluster Mizu & B9–B10
            {pdfFormat === 'grouping' ? ' (Format Grouping Lomba)' : ' (Format General)'}
          </p>
          <div className="flex justify-between items-center text-[10pt] text-slate-600 mt-3 pt-1 border-t border-slate-300">
            <span>Tanggal Cetak: <strong>{formattedToday}</strong></span>
            <span>Total Pendaftar: <strong>{filteredParticipants.length} Peserta</strong></span>
          </div>
        </div>

        {pdfFormat === 'general' ? (
          /* 1. FORMAT GENERAL (TABLE TUNGGAL) */
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>No</th>
                <th style={{ width: '14%' }}>Kode Reg</th>
                <th style={{ width: '20%' }}>Nama Peserta</th>
                <th style={{ width: '15%' }}>Nama Ortu</th>
                <th style={{ width: '18%' }}>Kategori / Role</th>
                <th style={{ width: '20%' }}>Lomba Diikuti</th>
                <th style={{ width: '8%' }}>Blok</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p, idx) => {
                const parentDisplay = (p.type === 'Anak / Remaja' || (p.namaOrangTua && p.namaOrangTua !== '-'))
                  ? p.namaOrangTua
                  : '-';

                return (
                  <tr key={p.id || idx}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                    <td style={{ fontWeight: 'bold' }}>{p.namaPeserta}</td>
                    <td style={{ fontWeight: parentDisplay !== '-' ? 'bold' : 'normal' }}>
                      {parentDisplay}
                    </td>
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
                      <div>Blok {p.blokRumah}</div>
                      {p.whatsapp && p.whatsapp !== '-' && <div style={{ fontSize: '8.5pt', color: '#475569' }}>{p.whatsapp}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* 2. FORMAT GROUPING LOMBA */
          <div className="space-y-4">
            {(() => {
              const { childrenMap, adultMap, performerMap } = getGroupedPdfData();
              const hasChildren = Object.keys(childrenMap).length > 0;
              const hasAdults = Object.keys(adultMap).length > 0;
              const hasPerformers = Object.keys(performerMap).length > 0;

              return (
                <>
                  {/* KATEGORI 1: LOMBA ANAK & REMAJA */}
                  {hasChildren && (
                    <div className="space-y-3">
                      <div className="print-section-header bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                        I. KATEGORI LOMBA ANAK & REMAJA
                      </div>

                      {Object.entries(childrenMap).map(([lombaTitle, plist]) => (
                        <div key={lombaTitle} className="space-y-1">
                          <div className="print-lomba-header font-bold text-[10pt] text-slate-800 bg-slate-100 p-1.5 border border-slate-300 flex justify-between items-center" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                            <span>🎯 LOMBA: {lombaTitle}</span>
                            <span className="text-[8.5pt] font-semibold text-slate-600">({plist.length} Peserta)</span>
                          </div>
                          <table className="print-table">
                            <thead>
                              <tr>
                                <th style={{ width: '6%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '15%' }}>Kode Reg</th>
                                <th style={{ width: '25%' }}>Nama Anak</th>
                                <th style={{ width: '22%' }}>Nama Orang Tua</th>
                                <th style={{ width: '18%' }}>Tingkatan / Kategori</th>
                                <th style={{ width: '14%' }}>Blok Rumah</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plist.map((p, i) => (
                                <tr key={p.id || i}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                                  <td style={{ fontWeight: 'bold' }}>{p.namaPeserta}</td>
                                  <td>{p.namaOrangTua || '-'}</td>
                                  <td>{p.kategoriGroup}</td>
                                  <td>Blok {p.blokRumah}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KATEGORI 2: LOMBA DEWASA & PASUTRI */}
                  {hasAdults && (
                    <div className="space-y-3 pt-2">
                      <div className="print-section-header bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                        II. KATEGORI LOMBA DEWASA & PASUTRI
                      </div>

                      {Object.entries(adultMap).map(([lombaTitle, plist]) => (
                        <div key={lombaTitle} className="space-y-1">
                          <div className="print-lomba-header font-bold text-[10pt] text-slate-800 bg-slate-100 p-1.5 border border-slate-300 flex justify-between items-center" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                            <span>🏆 LOMBA / ACARA: {lombaTitle}</span>
                            <span className="text-[8.5pt] font-semibold text-slate-600">({plist.length} Peserta)</span>
                          </div>
                          <table className="print-table">
                            <thead>
                              <tr>
                                <th style={{ width: '6%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '15%' }}>Kode Reg</th>
                                <th style={{ width: '25%' }}>Nama Peserta</th>
                                <th style={{ width: '22%' }}>Nama Pasangan</th>
                                <th style={{ width: '18%' }}>Kategori</th>
                                <th style={{ width: '14%' }}>Blok / Kontak</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plist.map((p, i) => (
                                <tr key={p.id || i}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                                  <td style={{ fontWeight: 'bold' }}>{p.namaPeserta}</td>
                                  <td>
                                    {(p.role === 'Pasutri' || p.kategoriGroup === 'Lomba Pasutri' || p.namaPeserta?.startsWith('Pasutri'))
                                      ? '-'
                                      : (p.namaPasangan || '-')}
                                  </td>
                                  <td>{p.kategoriGroup}</td>
                                  <td>
                                    <div>Blok {p.blokRumah}</div>
                                    {p.whatsapp && p.whatsapp !== '-' && <div style={{ fontSize: '8pt', color: '#475569' }}>{p.whatsapp}</div>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KATEGORI 3: PENGISI ACARA MALAM PUNCAK */}
                  {hasPerformers && (
                    <div className="space-y-3 pt-2">
                      <div className="print-section-header bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded uppercase tracking-wider" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                        III. PENGISI ACARA MALAM PUNCAK (17 AGUSTUS)
                      </div>

                      {Object.entries(performerMap).map(([jenisPenampilan, plist]) => (
                        <div key={jenisPenampilan} className="space-y-1">
                          <div className="print-lomba-header font-bold text-[10pt] text-slate-800 bg-slate-100 p-1.5 border border-slate-300 flex justify-between items-center" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                            <span>🎭 JENIS PENAMPILAN: {jenisPenampilan}</span>
                            <span className="text-[8.5pt] font-semibold text-slate-600">({plist.length} Penampil)</span>
                          </div>
                          <table className="print-table">
                            <thead>
                              <tr>
                                <th style={{ width: '6%', textAlign: 'center' }}>No</th>
                                <th style={{ width: '15%' }}>Kode Reg</th>
                                <th style={{ width: '30%' }}>Nama Penampil / Kelompok</th>
                                <th style={{ width: '20%' }}>Tipe (Solo / Grup)</th>
                                <th style={{ width: '15%' }}>Jumlah Anggota</th>
                                <th style={{ width: '14%' }}>Blok Rumah</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plist.map((p, i) => (
                                <tr key={p.id || i}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                                  <td style={{ fontWeight: 'bold' }}>{p.namaPeserta}</td>
                                  <td>{p.kategoriGroup || 'Performer'}</td>
                                  <td style={{ textAlign: 'center' }}>{p.umur || '1'} Orang</td>
                                  <td>Blok {p.blokRumah}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* WEB DASHBOARD UI (VISIBLE ON SCREEN, HIDDEN ON PRINT/PDF) */}
      {/* ---------------------------------------------------- */}

      {/* MAIN CONTENT AREA WITH ABSOLUTE SECTION BACKGROUND IMAGE */}
      <main className="print:hidden max-w-xl mx-auto px-4 pt-6 pb-2 relative">

        {/* ABSOLUTE SECTION BACKGROUND IMAGE (Node 237:856) */}
        <div
          className="absolute top-0 right-0 w-[85%] sm:w-[70%] h-[340px] bg-cover bg-right bg-no-repeat pointer-events-none z-0 overflow-hidden"
          style={{ backgroundImage: `url('/bg-seion-lomba.png')` }}
        >
          {/* Soft fade overlay to page background color #FAFBF8 */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FAFBF8] via-[#FAFBF8]/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#FAFBF8]" />
        </div>

        {/* HERO HEADER TEXT CONTAINER (Lebih Lapang & Wide: pt-9 pb-8) */}
        <div className="relative z-10 pt-9 pb-8 max-w-sm sm:max-w-md">
          {/* Header Pill Badge (Interactive House Block Selector) */}
          <button
            type="button"
            onClick={openEditHouseModal}
            className="inline-flex items-center gap-2 h-[32px] px-[14px] bg-[#F4F4F5]/90 hover:bg-[#E4E4E7] backdrop-blur-xs text-slate-800 rounded-full text-[12px] font-normal border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
          >
            <span className="w-[7px] h-[7px] rounded-full bg-[#83DF22] inline-block shrink-0" />
            <span>Formulir Pendaftaran</span>
            <span className="text-slate-300 font-light">|</span>
            <span className="font-semibold text-slate-900">{globalHouseBlock || 'Pilih No. Rumah'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-0.5" />
          </button>

          {/* Heading 2 & Subtitle with 6px gap */}
          <div className="mt-2">
            <h2 className="text-[21px] sm:text-[24px] font-medium text-[#0F172A] tracking-[-0.45px] leading-[30px]">
              Semarak Lomba Kemerdekaan Seion
            </h2>
            <p className="text-[13px] text-slate-500 font-normal mt-1.5 leading-tight">
              Batas pendaftaran : 6 Agu 2026
            </p>
          </div>
        </div>

        {/* TAB 1: FORM PENDAFTARAN */}
        {activeTab === 'register' && (
          <div className="relative z-10 space-y-4 pt-1">

            {/* EMBEDDED CATEGORY TABS (Node 237:716) */}
            <div className="relative z-10 bg-white border border-slate-200/80 rounded-full p-[3px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex items-center justify-between gap-1 mb-3">
              {[
                { id: 'children', label: 'Anak & Remaja' },
                { id: 'adults', label: 'Dewasa/Pasutri' },
                { id: 'performers', label: 'Pengisi Acara' }
              ].map((tab) => {
                const isActive = formType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFormType(tab.id as 'children' | 'adults' | 'performers')}
                    className="relative flex-1 h-[38px] px-3 text-xs sm:text-sm rounded-full transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap select-none z-10"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSubTabBg"
                        className="absolute inset-0 bg-gradient-to-b from-[#d2f54e] to-[#bcdb46] rounded-full shadow-xs -z-10"
                        transition={{
                          type: 'tween',
                          ease: [0.16, 1, 0.3, 1], // Cubic-bezier easing for smooth interpolation
                          duration: 0.35
                        }}
                      />
                    )}
                    <span className={`transition-colors duration-200 ${isActive ? 'text-[#020617] font-semibold' : 'text-[#475569] hover:text-slate-900 font-medium'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* MAIN FORM CARD (Node 237:741) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] relative z-10">
              <AnimatePresence mode="wait">
                {/* 1. FORM ANAK & REMAJA */}
                {formType === 'children' && (
                  <motion.form
                    key="children-form"
                    variants={cascadeContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleSaveRegistration}
                    className="space-y-4 sm:space-y-5"
                  >
                    <motion.div variants={cascadeItemVariants} className="pb-3 border-b border-slate-100">
                      <h3 className="text-base font-bold text-slate-900">Data Peserta Anak</h3>
                    </motion.div>

                    {/* FIELD 1: Nama Lengkap Anak */}
                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        Nama Lengkap Anak <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={childData.namaAnak}
                        onChange={(e) => setChildData({ ...childData, namaAnak: e.target.value })}
                        placeholder="Nama Lengkap Anak"
                        className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </motion.div>

                    {/* FIELD 2: DROPDOWN CUSTOM TINGKATAN SEKOLAH */}
                    <motion.div variants={cascadeItemVariants} className={`relative ${isDropdownOpen ? 'z-50' : 'z-20'}`}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        Tingkatan Sekolah <span className="text-rose-500">*</span>
                      </label>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className={`w-full h-[42px] px-[17px] bg-white border ${isDropdownOpen ? 'border-[#9EEA38] ring-2 ring-[#A3E635]/30' : 'border-slate-200/90'
                            } rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] font-normal text-[14px] text-slate-800 flex items-center justify-between transition-all cursor-pointer`}
                        >
                          {selectedGroupObj ? (
                            <div className="flex items-center gap-2.5">
                              {renderGroupIcon(selectedGroupObj.id, "w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0 stroke-[1.75]")}
                              <span className="font-normal text-slate-900">{selectedGroupObj.label}</span>
                            </div>
                          ) : (
                            <span className="font-normal text-[#94a3b8]">-- Pilih Tingkatan Sekolah --</span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-slate-700' : ''}`} />
                        </button>

                        {/* DROPDOWN POPUP MENU */}
                        <AnimatePresence>
                          {isDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />

                              <motion.div
                                variants={dropdownMenuVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ originY: 0 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.22),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 overflow-hidden"
                              >
                                {AGE_GROUPS.map((group) => {
                                  const isSelected = childData.tingkatanId === group.id;
                                  return (
                                    <motion.button
                                      key={group.id}
                                      variants={dropdownItemVariants}
                                      type="button"
                                      onClick={() => handleSelectTingkatan(group.id)}
                                      className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer active:scale-[0.99] ${isSelected
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
                                    </motion.button>
                                  );
                                })}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>

                    {/* FIELD 3: CABANG LOMBA */}
                    <motion.div variants={cascadeItemVariants} className="pt-2 space-y-3">
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
                                className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${isChecked
                                    ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                    : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                                  }`}
                              >
                                <div className="flex items-center gap-2.5 sm:gap-3">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
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
                              className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${childData.selectedLomba.includes(activeSelectedCategoryObj.coloringCat)
                                  ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                  : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                                }`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${childData.selectedLomba.includes(activeSelectedCategoryObj.coloringCat) ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
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
                              className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${childData.selectedLomba.includes(activeSelectedCategoryObj.fashionCat)
                                  ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                  : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                                }`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${childData.selectedLomba.includes(activeSelectedCategoryObj.fashionCat) ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
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
                            className={`w-full p-3 sm:p-3.5 rounded-2xl border text-xs sm:text-sm font-normal flex items-center justify-between transition-all cursor-pointer text-left ${childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)')
                                ? 'bg-[#F2FDE4] border-[#9EEA38] text-slate-900 shadow-2xs font-medium'
                                : 'bg-[#F8F9FA] border-slate-200 text-slate-700 hover:bg-slate-100/80'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)') ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                                }`}>
                                {childData.selectedLomba.includes('Parade Sepeda Hias (Minggu, 16 Ags)') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className="font-normal">Parade Sepeda Hias (Minggu, 16 Ags)</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </motion.div>

                    {/* FIELD 4: Kontak Orang Tua & Rumah */}
                    <motion.div variants={cascadeItemVariants} className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      <div>
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">
                          Nama Orang Tua <span className="text-slate-400 font-normal">(Opsional)</span>
                        </label>
                        <input
                          type="text"
                          value={childData.namaOrangTua}
                          onChange={(e) => setChildData({ ...childData, namaOrangTua: e.target.value })}
                          placeholder="Nama Orang Tua"
                          className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">
                          No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                        </label>
                        <input
                          type="tel"
                          value={childData.whatsapp}
                          onChange={(e) => setChildData({ ...childData, whatsapp: e.target.value })}
                          placeholder="0812xxxxxxx"
                          className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                        />
                      </div>
                    </motion.div>

                    {/* Submit Button */}
                    <motion.div variants={cascadeItemVariants}>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[44px] bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 font-bold text-sm rounded-full shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                        Kirim Pendaftaran Anak
                      </button>
                    </motion.div>
                  </motion.form>
                )}

                {/* 2. FORM DEWASA & PASUTRI */}
                {formType === 'adults' && (
                  <motion.form
                    key="adults-form"
                    variants={cascadeContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleSaveRegistration}
                    className="space-y-4 sm:space-y-5"
                  >
                    <motion.div variants={cascadeItemVariants} className="pb-2 border-b border-slate-100">
                      <h3 className="text-base font-bold text-slate-900">Data Peserta Dewasa / Pasutri</h3>
                    </motion.div>

                    {/* FIELD 1: NAMA LENGKAP */}
                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        Nama Lengkap <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adultData.namaPeserta}
                        onChange={(e) => setAdultData({ ...adultData, namaPeserta: e.target.value })}
                        placeholder="Nama Lengkap"
                        className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </motion.div>

                    {/* FIELD 3: KAMU SEBAGAI APA */}
                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        Kamu sebagai apa <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAdultData(prev => {
                              const newRole = 'Bapak Bapak';
                              let newLomba = prev.selectedLomba;
                              if (!prev.hasSpouse) {
                                newLomba = newLomba.filter(l => !['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].includes(l));
                              }
                              return { ...prev, role: newRole, selectedLomba: newLomba };
                            });
                          }}
                          className={`h-[44px] px-4 rounded-[12px] border text-xs sm:text-sm font-normal flex items-center gap-3 transition-all cursor-pointer ${
                            adultData.role === 'Bapak Bapak'
                              ? 'bg-white border-slate-900 text-slate-900 shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            adultData.role === 'Bapak Bapak' ? 'border-slate-900 bg-white' : 'border-slate-300'
                          }`}>
                            {adultData.role === 'Bapak Bapak' && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                          </div>
                          <span>Bapak Bapak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdultData(prev => {
                              const newRole = 'Ibu-Ibu';
                              let newLomba = prev.selectedLomba;
                              if (!prev.hasSpouse) {
                                newLomba = newLomba.filter(l => !['Tendangan Penalti (Bapak-Bapak)', 'Lempar Bola Pakai Sarung (Bapak-Bapak)'].includes(l));
                              }
                              return { ...prev, role: newRole, selectedLomba: newLomba };
                            });
                          }}
                          className={`h-[44px] px-4 rounded-[12px] border text-xs sm:text-sm font-normal flex items-center gap-3 transition-all cursor-pointer ${
                            adultData.role === 'Ibu-Ibu'
                              ? 'bg-white border-slate-900 text-slate-900 shadow-xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            adultData.role === 'Ibu-Ibu' ? 'border-slate-900 bg-white' : 'border-slate-300'
                          }`}>
                            {adultData.role === 'Ibu-Ibu' && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                          </div>
                          <span>Ibu-Ibu</span>
                        </button>
                      </div>
                    </motion.div>

                    {/* FIELD 4: NAMA PASANGAN */}
                    {adultData.hasSpouse && (
                      <motion.div variants={cascadeItemVariants} className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">
                          {adultData.role === 'Ibu-Ibu' ? 'Nama Lengkap Suami' : 'Nama Lengkap Istri'} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={adultData.hasSpouse}
                          value={adultData.namaPasangan}
                          onChange={(e) => setAdultData({ ...adultData, namaPasangan: e.target.value })}
                          placeholder={adultData.role === 'Ibu-Ibu' ? 'Nama Suami' : 'Nama Istri'}
                          className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                        />
                      </motion.div>
                    )}

                    {/* FIELD 5: CHECKBOX TOGGLE PASUTRI */}
                    <motion.div variants={cascadeItemVariants}>
                      <button
                        type="button"
                        onClick={() => setAdultData(prev => {
                          const newHasSpouse = !prev.hasSpouse;
                          let newLomba = prev.selectedLomba;
                          if (!newHasSpouse) {
                            newLomba = newLomba.filter(l => !['Make Up Pasangan', 'Joget Balon Pasutri'].includes(l));
                            if (prev.role === 'Bapak Bapak') {
                              newLomba = newLomba.filter(l => !['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].includes(l));
                            } else {
                              newLomba = newLomba.filter(l => !['Tendangan Penalti (Bapak-Bapak)', 'Lempar Bola Pakai Sarung (Bapak-Bapak)'].includes(l));
                            }
                          }
                          return { ...prev, hasSpouse: newHasSpouse, selectedLomba: newLomba };
                        })}
                        className="w-full py-3 px-4 bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-[12px] border border-slate-200/80 text-xs sm:text-sm font-normal text-slate-700 flex items-center gap-3 transition-all cursor-pointer text-left"
                      >
                        <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                          adultData.hasSpouse ? 'bg-slate-900 text-white' : 'border border-slate-400 bg-white'
                        }`}>
                          {adultData.hasSpouse && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-normal text-slate-800">
                          {adultData.hasSpouse
                            ? 'Uncheck jika mendaftarkan tanpa pasangan'
                            : 'Checklist untuk menambahkan nama pasangan suami / istri'}
                        </span>
                      </button>
                    </motion.div>

                    {/* LOMBA SECTIONS */}
                    <motion.div variants={cascadeItemVariants} className="space-y-4 pt-1">
                      
                      {/* SECTION 1: LOMBA PASUTRI */}
                      <div>
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">
                          Lomba Pasutri (Minggu, 16 Ags) <span className="text-rose-500">*</span>
                        </label>
                        <div className="space-y-2">
                          {['Make Up Pasangan', 'Joget Balon Pasutri'].map((item, itemIdx) => {
                            const isChecked = adultData.selectedLomba.includes(item);
                            const isDisabled = !adultData.hasSpouse;
                            return (
                              <button
                                key={itemIdx}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => toggleAdultLomba(item)}
                                className={`w-full h-[42px] px-[16px] rounded-[8px] text-[14px] flex items-center gap-[12px] transition-all cursor-pointer text-left ${
                                  isDisabled
                                    ? 'bg-[#EEEEEE] text-slate-400 border border-transparent pointer-events-none'
                                    : isChecked
                                      ? 'bg-[#F2FDE4] border border-[#9EEA38] text-slate-950 font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)]'
                                      : 'bg-white border border-slate-200/90 text-slate-800 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                  isChecked
                                    ? 'bg-[#83DF22] text-slate-950'
                                    : isDisabled
                                      ? 'border border-slate-300 bg-white'
                                      : 'border border-slate-300 bg-white'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION 2: LOMBA BAPAK-BAPAK */}
                      {(adultData.hasSpouse || adultData.role === 'Bapak Bapak') && (
                        <div className="animate-in fade-in-0 duration-200">
                          <label className="block text-[12px] font-medium text-slate-700 mb-2">
                            Lomba Bapak-Bapak (Minggu, 16 Ags) <span className="text-rose-500">*</span>
                          </label>
                          <div className="space-y-2">
                            {['Tendangan Penalti (Bapak-Bapak)', 'Lempar Bola Pakai Sarung (Bapak-Bapak)'].map((item, itemIdx) => {
                              const isChecked = adultData.selectedLomba.includes(item);
                              const displayLabel = item.replace(' (Bapak-Bapak)', '');
                              return (
                                <button
                                  key={itemIdx}
                                  type="button"
                                  onClick={() => toggleAdultLomba(item)}
                                  className={`w-full h-[42px] px-[16px] rounded-[8px] text-[14px] flex items-center gap-[12px] transition-all cursor-pointer text-left ${
                                    isChecked
                                      ? 'bg-[#F2FDE4] border border-[#9EEA38] text-slate-950 font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)]'
                                      : 'bg-white border border-slate-200/90 text-slate-800 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                    isChecked ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span>{displayLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* SECTION 3: LOMBA IBU-IBU */}
                      {(adultData.hasSpouse || adultData.role === 'Ibu-Ibu') && (
                        <div className="animate-in fade-in-0 duration-200">
                          <label className="block text-[12px] font-medium text-slate-700 mb-2">
                            Lomba Ibu-Ibu (Minggu, 16 Ags) <span className="text-rose-500">*</span>
                          </label>
                          <div className="space-y-2">
                            {['Kepiting Air', 'Balap Kelereng di Dalam Kolam Renang'].map((item, itemIdx) => {
                              const isChecked = adultData.selectedLomba.includes(item);
                              const displayLabel = item;
                              return (
                                <button
                                  key={itemIdx}
                                  type="button"
                                  onClick={() => toggleAdultLomba(item)}
                                  className={`w-full h-[42px] px-[16px] rounded-[8px] text-[14px] flex items-center gap-[12px] transition-all cursor-pointer text-left ${
                                    isChecked
                                      ? 'bg-[#F2FDE4] border border-[#9EEA38] text-slate-950 font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)]'
                                      : 'bg-white border border-slate-200/90 text-slate-800 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                    isChecked ? 'bg-[#83DF22] text-slate-950' : 'border border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span>{displayLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </motion.div>

                    {/* FIELD WHATSAPP */}
                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="tel"
                        value={adultData.whatsapp}
                        onChange={(e) => setAdultData({ ...adultData, whatsapp: e.target.value })}
                        placeholder="0812xxxxxxx"
                        className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </motion.div>

                    <motion.div variants={cascadeItemVariants}>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[44px] bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 font-bold text-sm rounded-full shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                        Kirim Pendaftaran Dewasa
                      </button>
                    </motion.div>
                  </motion.form>
                )}

                {/* 3. FORM PENGISI ACARA */}
                {formType === 'performers' && (
                  <motion.form
                    key="performers-form"
                    variants={cascadeContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleSaveRegistration}
                    className="space-y-4 sm:space-y-5"
                  >
                    <motion.div variants={cascadeItemVariants} className="pb-3 border-b border-slate-100">
                      <h3 className="text-base font-bold text-slate-900">Pengisi Acara Malam Puncak (17 Ags)</h3>
                    </motion.div>

                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        Nama Penampil / Kelompok <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={performerData.namaPenampil}
                        onChange={(e) => setPerformerData({ ...performerData, namaPenampil: e.target.value })}
                        placeholder="Nama Penampil / Kelompok"
                        className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </motion.div>

                    {/* CUSTOM DROPDOWN: JENIS PENAMPILAN */}
                    <motion.div variants={cascadeItemVariants} className={`relative ${isJenisPenampilanOpen ? 'z-50' : 'z-20'}`}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">Jenis Penampilan</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsJenisPenampilanOpen(!isJenisPenampilanOpen)}
                          className={`w-full h-[42px] px-[17px] bg-white border ${isJenisPenampilanOpen ? 'border-[#9EEA38] ring-2 ring-[#A3E635]/30' : 'border-slate-200/90'
                            } rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] font-normal text-[14px] text-slate-800 flex items-center justify-between transition-all cursor-pointer`}
                        >
                          <span className="font-normal text-slate-900">{performerData.jenisPenampilan}</span>
                          <ChevronDown className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 shrink-0 ${isJenisPenampilanOpen ? 'rotate-180 text-slate-700' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {isJenisPenampilanOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsJenisPenampilanOpen(false)} />
                              <motion.div
                                variants={dropdownMenuVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ originY: 0 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.22),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 overflow-hidden"
                              >
                                {['Pembawa Acara', 'Menyanyi', 'Menari', 'Puisi / Drama', 'Lainnya'].map((opt) => {
                                  const isSelected = performerData.jenisPenampilan === opt;
                                  return (
                                    <motion.button
                                      key={opt}
                                      variants={dropdownItemVariants}
                                      type="button"
                                      onClick={() => {
                                        setPerformerData(prev => ({ ...prev, jenisPenampilan: opt }));
                                        setIsJenisPenampilanOpen(false);
                                      }}
                                      className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer active:scale-[0.99] ${isSelected
                                          ? 'bg-[#F2FDE4] font-medium text-slate-950 border border-[#9EEA38]/80'
                                          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-950 font-normal'
                                        }`}
                                    >
                                      <span className="font-normal text-xs sm:text-sm">{opt}</span>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-emerald-700 stroke-[2.5] shrink-0" />
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>

                    {/* KATEGORI & JUMLAH ANGGOTA */}
                    <motion.div variants={cascadeItemVariants} className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 relative ${isKategoriPerformerOpen ? 'z-50' : 'z-10'}`}>
                      {/* CUSTOM DROPDOWN: KATEGORI */}
                      <div>
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">Kategori</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsKategoriPerformerOpen(!isKategoriPerformerOpen)}
                            className={`w-full h-[42px] px-[17px] bg-white border ${isKategoriPerformerOpen ? 'border-[#9EEA38] ring-2 ring-[#A3E635]/30' : 'border-slate-200/90'
                              } rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] font-normal text-[14px] text-slate-800 flex items-center justify-between transition-all cursor-pointer`}
                          >
                            <span className="font-normal text-slate-900">
                              {performerData.tipe === 'Individu' ? 'Individu (Solo)' : 'Kelompok / Grup'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 shrink-0 ${isKategoriPerformerOpen ? 'rotate-180 text-slate-700' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {isKategoriPerformerOpen && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsKategoriPerformerOpen(false)} />
                                <motion.div
                                  variants={dropdownMenuVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  style={{ originY: 0 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.22),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 overflow-hidden"
                                >
                                  {[
                                    { id: 'Individu', label: 'Individu (Solo)' },
                                    { id: 'Kelompok', label: 'Kelompok / Grup' }
                                  ].map((opt) => {
                                    const isSelected = performerData.tipe === opt.id;
                                    return (
                                      <motion.button
                                        key={opt.id}
                                        variants={dropdownItemVariants}
                                        type="button"
                                        onClick={() => {
                                          setPerformerData(prev => ({
                                            ...prev,
                                            tipe: opt.id,
                                            jumlahOrang: opt.id === 'Individu' ? '1' : (prev.jumlahOrang === '1' ? '2' : prev.jumlahOrang)
                                          }));
                                          setIsKategoriPerformerOpen(false);
                                        }}
                                        className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer active:scale-[0.99] ${isSelected
                                            ? 'bg-[#F2FDE4] font-medium text-slate-950 border border-[#9EEA38]/80'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-950 font-normal'
                                          }`}
                                      >
                                        <span className="font-normal text-xs sm:text-sm">{opt.label}</span>
                                        {isSelected && (
                                          <Check className="w-4 h-4 text-emerald-700 stroke-[2.5] shrink-0" />
                                        )}
                                      </motion.button>
                                    );
                                  })}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* JUMLAH ANGGOTA */}
                      <div>
                        <label className="block text-[12px] font-medium text-slate-700 mb-2">Jumlah Anggota</label>
                        <input
                          type="number"
                          min="1"
                          disabled={performerData.tipe === 'Individu'}
                          value={performerData.tipe === 'Individu' ? '1' : performerData.jumlahOrang}
                          onChange={(e) => setPerformerData({ ...performerData, jumlahOrang: e.target.value })}
                          className={`w-full h-[42px] px-[17px] border border-slate-200/90 rounded-[8px] transition-all font-normal text-[14px] ${performerData.tipe === 'Individu'
                              ? 'bg-[#EEEEEE] text-slate-400 cursor-not-allowed'
                              : 'bg-white text-slate-800 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38]'
                            }`}
                        />
                      </div>
                    </motion.div>

                    <motion.div variants={cascadeItemVariants}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-2">
                        No. WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="tel"
                        value={performerData.whatsapp}
                        onChange={(e) => setPerformerData({ ...performerData, whatsapp: e.target.value })}
                        placeholder="0812xxxxxxx"
                        className="w-full h-[42px] px-[17px] bg-white border border-slate-200/90 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </motion.div>

                    <motion.div variants={cascadeItemVariants}>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[44px] bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 font-bold text-sm rounded-full shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                        Daftar Pengisi Acara
                      </button>
                    </motion.div>
                  </motion.form>
                )}
              </AnimatePresence>
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
          <div className="relative z-10 space-y-4">
            <div className="bg-white p-4 border border-slate-200/80 rounded-3xl shadow-2xs space-y-3">
              {/* Search Bar */}
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

              {/* Action Bar (Counter + Icon-only Filter Button + Single Unified Export Button) */}
              <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-100 mt-2">
                <span className="text-xs font-bold text-slate-800">{filteredParticipants.length} Peserta</span>

                <div className="flex items-center gap-2 relative z-30">
                  {/* FILTER BUTTON (ICON ONLY + RADIO POPUP) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                      title="Filter Tampilan & Grouping"
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-[0.96] ${
                        groupingMode !== 'default'
                          ? 'bg-[#EAFCD7] border-[#9EEA38] text-emerald-950 shadow-2xs ring-2 ring-[#9EEA38]/30'
                          : 'bg-[#F8F9FA] hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {filterMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setFilterMenuOpen(false)} />
                          <motion.div
                            variants={dropdownMenuVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{ originY: 0 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.25),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 text-left overflow-hidden"
                          >
                            <div className="px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                              Tampilan & Grouping Data
                            </div>

                            {/* Radio Option 1: Default */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => {
                                setGroupingMode('default');
                                setFilterMenuOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 cursor-pointer transition-colors group active:scale-[0.99] ${
                                groupingMode === 'default' ? 'bg-[#F2FDE4] font-bold text-slate-900' : 'hover:bg-slate-100/90 text-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                groupingMode === 'default' ? 'border-[#83DF22] bg-[#83DF22]' : 'border-slate-300'
                              }`}>
                                {groupingMode === 'default' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">Default (Terbaru)</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Urut pendaftaran terbaru</div>
                              </div>
                            </motion.button>

                            {/* Radio Option 2: Grouping per Blok Rumah */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => {
                                setGroupingMode('blok');
                                setFilterMenuOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 cursor-pointer transition-colors group active:scale-[0.99] ${
                                groupingMode === 'blok' ? 'bg-[#F2FDE4] font-bold text-slate-900' : 'hover:bg-slate-100/90 text-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                groupingMode === 'blok' ? 'border-[#83DF22] bg-[#83DF22]' : 'border-slate-300'
                              }`}>
                                {groupingMode === 'blok' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">Group: Blok Rumah</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Dikelompokkan per section Blok</div>
                              </div>
                            </motion.button>

                            {/* Radio Option 3: Grouping per Cabang Lomba */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => {
                                setGroupingMode('lomba');
                                setFilterMenuOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 cursor-pointer transition-colors group active:scale-[0.99] ${
                                groupingMode === 'lomba' ? 'bg-[#F2FDE4] font-bold text-slate-900' : 'hover:bg-slate-100/90 text-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                groupingMode === 'lomba' ? 'border-[#83DF22] bg-[#83DF22]' : 'border-slate-300'
                              }`}>
                                {groupingMode === 'lomba' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">Group: Cabang Lomba</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Dikelompokkan per jenis lomba</div>
                              </div>
                            </motion.button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* SINGLE UNIFIED EXPORT BUTTON */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExportMenuOpen(!exportMenuOpen)}
                      className="h-9 px-3.5 bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] cursor-pointer whitespace-nowrap active:scale-[0.98]"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0 text-slate-950 stroke-[2.2]" />
                      <span>Export</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-900 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {exportMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setExportMenuOpen(false)} />
                          <motion.div
                            variants={dropdownMenuVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{ originY: 0 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-1.5 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.25),0_10px_20px_-15px_rgba(22,23,24,0.1)] z-40 space-y-1 text-left overflow-hidden"
                          >
                            {/* Option 1: Excel (.csv) */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => {
                                exportToExcel();
                                setExportMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 hover:bg-[#F2FDE4] cursor-pointer transition-colors group active:scale-[0.99]"
                            >
                              <div className="w-7 h-7 bg-[#EAFCD7] rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-emerald-800">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                              </div>
                              <div>
                                <div className="font-bold text-xs text-slate-900">1. Excel (.csv)</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Spreadsheet data peserta</div>
                              </div>
                            </motion.button>

                            {/* Option 2: PDF General */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => triggerPdfPrint('general')}
                              className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 hover:bg-slate-100/90 cursor-pointer transition-colors group active:scale-[0.99]"
                            >
                              <div className="w-7 h-7 bg-slate-100 group-hover:bg-slate-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-slate-800">
                                <Printer className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-xs text-slate-900">2. PDF Format General</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Tabel ringkas peserta berurutan</div>
                              </div>
                            </motion.button>

                            {/* Option 3: PDF Grouping */}
                            <motion.button
                              variants={dropdownItemVariants}
                              type="button"
                              onClick={() => triggerPdfPrint('grouping')}
                              className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-2.5 hover:bg-[#F2FDE4] hover:border hover:border-[#9EEA38]/60 cursor-pointer transition-colors group active:scale-[0.99]"
                            >
                              <div className="w-7 h-7 bg-[#EAFCD7] rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-emerald-800">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-xs text-slate-900">3. PDF Grouping Lomba</div>
                                <div className="text-[10.5px] text-slate-500 font-normal">Dikelompokkan per Kategori & Lomba</div>
                              </div>
                            </motion.button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Belum ada data peserta pendaftaran.
              </div>
            ) : groupingMode === 'blok' ? (
              /* SECTION BY SECTION: BLOK RUMAH */
              <div className="space-y-5">
                {groupedByBlok.map(({ blokKey, items }) => (
                  <div key={blokKey} className="space-y-2.5">
                    <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xs">
                      <span className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-[#C5F542]" />
                        <span>Blok {blokKey}</span>
                      </span>
                      <span className="text-[10.5px] font-extrabold text-[#C5F542] bg-slate-800 px-2.5 py-0.5 rounded-full">
                        {items.length} Peserta
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {items.map((p, idx) => (
                        <div key={p.id || idx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-[#BCE88C] transition-colors space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 font-normal mr-0.5">#{idx + 1}</span>
                              <span>{p.namaPeserta}</span>
                              {p.umur && <span className="text-xs text-slate-500 font-normal">({p.umur} Thn)</span>}
                            </h4>
                            <button
                              onClick={() => setDeleteModalId(p.id)}
                              className="print:hidden p-1 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer shrink-0 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1 bg-[#F8F9FA] p-3 rounded-xl">
                            <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">{p.type} • {p.kategoriGroup}</p>
                            <ul className="list-disc list-inside text-slate-800 font-semibold space-y-0.5 pt-0.5">
                              {p.lomba?.map((l, i) => <li key={i}>{cleanLombaTitle(l)}</li>)}
                            </ul>
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[10px] font-mono font-extrabold text-emerald-700 bg-[#E8FCD0] px-2 py-0.5 rounded-md">
                              {p.code}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">Blok: {p.blokRumah}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : groupingMode === 'lomba' ? (
              /* SECTION BY SECTION: CABANG LOMBA */
              <div className="space-y-5">
                {groupedByLomba.map(({ lombaKey, items }) => (
                  <div key={lombaKey} className="space-y-2.5">
                    <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xs">
                      <span className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-[#C5F542]" />
                        <span>{lombaKey}</span>
                      </span>
                      <span className="text-[10.5px] font-extrabold text-[#C5F542] bg-slate-800 px-2.5 py-0.5 rounded-full">
                        {items.length} Peserta
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {items.map((p, idx) => (
                        <div key={p.id || idx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-[#BCE88C] transition-colors space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 font-normal mr-0.5">#{idx + 1}</span>
                              <span>{p.namaPeserta}</span>
                              {p.umur && <span className="text-xs text-slate-500 font-normal">({p.umur} Thn)</span>}
                            </h4>
                            <button
                              onClick={() => setDeleteModalId(p.id)}
                              className="print:hidden p-1 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer shrink-0 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1 bg-[#F8F9FA] p-3 rounded-xl">
                            <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">{p.type} • {p.kategoriGroup}</p>
                            <ul className="list-disc list-inside text-slate-800 font-semibold space-y-0.5 pt-0.5">
                              {p.lomba?.map((l, i) => <li key={i}>{cleanLombaTitle(l)}</li>)}
                            </ul>
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[10px] font-mono font-extrabold text-emerald-700 bg-[#E8FCD0] px-2 py-0.5 rounded-md">
                              {p.code}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">Blok: {p.blokRumah}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* DEFAULT FLAT LIST WITH INFINITE SCROLL */
              <div className="space-y-2.5">
                {/* PARTICIPANT CARDS — INFINITE SCROLL */}
                {visibleParticipants.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.22, delay: Math.min(idx % ITEMS_PER_BATCH, 6) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-[#BCE88C] transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 font-normal mr-0.5">#{idx + 1}</span>
                        <span>{p.namaPeserta}</span>
                        {p.umur && <span className="text-xs text-slate-500 font-normal">({p.umur} Thn)</span>}
                      </h4>
                      <button
                        onClick={() => setDeleteModalId(p.id)}
                        className="print:hidden p-1 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer shrink-0 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-[#F8F9FA] p-3 rounded-xl">
                      <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">{p.type} • {p.kategoriGroup}</p>
                      <ul className="list-disc list-inside text-slate-800 font-semibold space-y-0.5 pt-0.5">
                        {p.lomba?.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] font-mono font-extrabold text-emerald-700 bg-[#E8FCD0] px-2 py-0.5 rounded-md">
                        {p.code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700">Blok: {p.blokRumah}</span>
                    </div>
                  </motion.div>
                ))}


                {/* LOADING INDICATOR */}
                <AnimatePresence>
                  {isLoadingMore && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2.5 py-4 text-slate-400"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full"
                      />
                      <span className="text-[11px] font-medium">Memuat lebih banyak…</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* END STATE */}
                {!hasMore && filteredParticipants.length > ITEMS_PER_BATCH && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 justify-center py-3"
                  >
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10.5px] text-slate-400 font-medium whitespace-nowrap">
                      Semua {filteredParticipants.length} peserta sudah tampil
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </motion.div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="relative z-10 bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Agenda Perlombaan Seion 2026</h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 sm:p-4 bg-[#F8F9FA] border border-slate-200/80 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Minggu, 9 Agustus 2026</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-semibold text-[10px]">Hari 1</span>
                </div>
                <p className="text-slate-600">🎯 Lomba Ketangkasan Anak</p>
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

      {/* FLOATING BOTTOM NAV BAR & MORPHING PIN DIALOG */}
      {/* 1. Backdrop Overlay */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => {
              setShowPinModal(false);
              setPinInput('');
              setPinError('');
            }}
            className="print:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* 2. Persistent Single Morphing Container */}
      <div
        className={`print:hidden fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out pointer-events-none ${
          showPinModal
            ? 'top-1/2 -translate-y-1/2 w-full max-w-[92vw] sm:max-w-sm'
            : 'bottom-5 w-[160px] h-[56px]'
        }`}
      >
        <motion.div
          layout
          transition={{
            type: "spring",
            stiffness: 350,
            damping: 30,
            mass: 0.8
          }}
          animate={isShaking ? { x: [-12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
          className={`pointer-events-auto overflow-hidden transition-colors duration-300 ${
            showPinModal
              ? 'bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative text-slate-900'
              : 'bg-white/80 backdrop-blur-[7.5px] rounded-full p-[4px] border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-between w-[160px] h-[56px]'
          }`}
        >
          <AnimatePresence mode="wait">
            {!showPinModal ? (
              /* FLOATING BOTTOM NAV BAR BUTTONS */
              <motion.div
                key="nav-buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between gap-[4px] w-full h-full"
              >
                {/* BUTTON 1: HOME / REGISTER */}
                <button
                  type="button"
                  title="Form Pendaftaran"
                  onClick={() => handleTabClick('register')}
                  className={`w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-[#C5F542] text-[#0F172A] shadow-xs'
                      : 'bg-[#F4F4F5] text-[#334155] hover:bg-[#E4E4E7]'
                  }`}
                >
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10.5L12 3L21 10.5V20A1 1 0 0 1 20 21H15V14H9V21H4A1 1 0 0 1 3 20V10.5Z" />
                  </svg>
                </button>

                {/* BUTTON 2: PESERTA (ADMIN) */}
                <button
                  type="button"
                  title={isAdminUnlocked ? "Data Peserta" : "Data Peserta (Terkunci PIN)"}
                  onClick={() => handleTabClick('participants')}
                  className={`w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    activeTab === 'participants'
                      ? 'bg-[#C5F542] text-[#0F172A] shadow-xs'
                      : 'bg-[#F4F4F5] text-[#334155] hover:bg-[#E4E4E7]'
                  }`}
                >
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>

                {/* BUTTON 3: JADWAL */}
                <button
                  type="button"
                  title="Jadwal Acara"
                  onClick={() => handleTabClick('schedule')}
                  className={`w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    activeTab === 'schedule'
                      ? 'bg-[#C5F542] text-[#0F172A] shadow-xs'
                      : 'bg-[#F4F4F5] text-[#334155] hover:bg-[#E4E4E7]'
                  }`}
                >
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </motion.div>
            ) : (
              /* PIN FORM CONTENT */
              <motion.div
                key="pin-form-content"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="space-y-5 relative"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="absolute right-0 top-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="text-center space-y-1.5 pt-1">
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
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{pinError}</span>
                    </motion.div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinModal(false);
                        setPinInput('');
                        setPinError('');
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 h-[44px] bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 font-bold text-xs rounded-full shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] cursor-pointer flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99]"
                    >
                      <KeyRound className="w-4 h-4 stroke-[2.5]" /> Masuk Admin
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

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
                <span className="text-slate-400 block mb-1">Lomba Diikuti:</span>
                {(() => {
                  const { pasutri, bapak, ibu, general, bapakName, ibuName } = categorizeLombaForDisplay(
                    ticketModal.lomba || [],
                    ticketModal.role,
                    ticketModal.namaPeserta,
                    ticketModal.namaPasangan
                  );
                  const hasCategorized = pasutri.length > 0 || bapak.length > 0 || ibu.length > 0;

                  if (!hasCategorized) {
                    return (
                      <ul className="list-disc list-inside font-semibold text-slate-800 space-y-0.5">
                        {ticketModal.lomba?.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    );
                  }

                  return (
                    <div className="space-y-1.5 bg-[#F8F9FA] p-2.5 rounded-xl border border-slate-200/80">
                      {pasutri.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded mr-1">
                            👥 Lomba Pasutri
                          </span>
                          <span className="text-slate-900 font-bold">{pasutri.join(', ')}</span>
                        </div>
                      )}
                      {bapak.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[10px] font-extrabold uppercase text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded mr-1">
                            👨 Lomba Bapak-Bapak
                          </span>
                          <span className="text-slate-900 font-bold">{bapak.join(', ')}</span>
                        </div>
                      )}
                      {ibu.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[10px] font-extrabold uppercase text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded mr-1">
                            👩 Lomba Ibu-Ibu
                          </span>
                          <span className="text-slate-900 font-bold">{ibu.join(', ')}</span>
                        </div>
                      )}
                      {general.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[10px] font-extrabold uppercase text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded mr-1">
                            🎯 Lomba Lainnya
                          </span>
                          <span className="text-slate-900 font-bold">{general.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="print:hidden flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-full flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-[0.99]"
              >
                <Printer className="w-4 h-4" /> Cetak
              </button>
              <button
                onClick={() => {
                  setTicketModal(null);
                }}
                className="flex-1 h-[44px] bg-[#C5F542] hover:bg-[#B3EE23] active:bg-[#A6E215] text-slate-950 font-bold text-xs rounded-full shadow-[0px_-1px_3px_0px_rgba(0,0,0,0.10)] flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-[0.99]"
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

      {/* WELCOME PAGE & EDIT NO. RUMAH MODAL DIALOG */}
      <AnimatePresence>
        {isHouseModalOpen && (
          <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (houseModalMode === 'edit' && globalHouseBlock) {
                  setIsHouseModalOpen(false);
                }
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Modal Dialog Container (Matching Figma 242:1362) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200/90 w-full max-w-[92vw] sm:max-w-[380px] rounded-[32px] overflow-hidden shadow-2xl relative z-10 text-slate-900"
            >
              {/* TOP ILLUSTRATION BANNER IMAGE (ABSOLUTE TOP) */}
              <div className="relative w-full h-[185px] sm:h-[200px] overflow-hidden bg-amber-50">
                <img
                  src="/dialog-seion.png"
                  alt="Illustration"
                  className="w-full h-[250px] object-cover object-top select-none pointer-events-none"
                />
                {/* BOTTOM GRADIENT FADE TO WHITE */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/70 to-transparent" />

                {/* CLOSE BUTTON IF EDIT MODE */}
                {houseModalMode === 'edit' && globalHouseBlock && (
                  <button
                    type="button"
                    onClick={() => setIsHouseModalOpen(false)}
                    className="absolute right-3.5 top-3.5 w-8 h-8 bg-white/80 hover:bg-white backdrop-blur-md text-slate-700 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-xs z-20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* DIALOG CONTENT BODY */}
              <div className="p-5 sm:p-6 pt-2 sm:pt-3 space-y-4 sm:space-y-5">
                {/* HEADING TEXT MATCHING FIGMA */}
                <div className="space-y-1 pb-3.5 sm:pb-4 border-b border-slate-100/90">
                  <h3 className="font-bold text-slate-900 text-[15px] sm:text-[16px] leading-snug">
                    Selamat datang di form pendaftaran
                  </h3>
                  <p className="font-semibold text-slate-900 text-[15px] sm:text-[16px] leading-snug">
                    Agar lebih mudah tulis blok dan<br />nomor rumah dahulu ya.
                  </p>
                </div>

                {/* FORM INPUTS MATCHING FIGMA DESIGN */}
                <form onSubmit={handleSaveHouseBlock} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-2">
                      Blok / No. Rumah <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                      {/* DROPDOWN BLOK */}
                      <div className="relative">
                        <select
                          required
                          value={selectedBlokPrefix}
                          onChange={(e) => setSelectedBlokPrefix(e.target.value as 'B' | 'C')}
                          className="w-full h-[44px] px-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>Blok</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* SUB-BLOK NUMBER INPUT */}
                      <input
                        type="text"
                        required
                        value={subBlokInput}
                        onChange={(e) => setSubBlokInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="15"
                        className="w-full h-[44px] px-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />

                      {/* HOUSE NUMBER INPUT */}
                      <input
                        type="text"
                        required
                        value={noRumahInput}
                        onChange={(e) => setNoRumahInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="No."
                        className="w-full h-[44px] px-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#A3E635] focus:border-[#9EEA38] transition-all font-normal text-[14px] text-slate-800 placeholder:font-normal placeholder:text-[#94a3b8]"
                      />
                    </div>
                  </div>

                  {/* LANJUTKAN BUTTON MATCHING FIGMA LIME PILL BUTTON */}
                  <button
                    type="submit"
                    className="w-full h-[48px] bg-[#C5F542] hover:bg-[#B3EE23] text-slate-950 font-bold text-sm rounded-full shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Lanjutkan</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
