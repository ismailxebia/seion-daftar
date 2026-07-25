import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFBF8] flex items-center justify-center p-4 text-center">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-sm w-full space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">Halaman yang Anda cari tidak tersedia.</p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-slate-900 text-[#D2F54E] font-bold text-xs rounded-xl"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
