import { Building2 } from "lucide-react";
import type { SchoolProfile } from "@/lib/types";

// Kop surat resmi sekolah — dipakai otomatis pada semua laporan yang dicetak.
export function KopSurat({ profile, title, subtitle }: { profile: SchoolProfile; title: string; subtitle?: string }) {
  const alamat = [profile.alamat, profile.kelurahan, profile.kecamatan, profile.kota, profile.provinsi, profile.kode_pos]
    .filter(Boolean)
    .join(", ");
  const kontak = [profile.telepon && `Telp: ${profile.telepon}`, profile.email, profile.website].filter(Boolean).join(" | ");
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 border-b-[3px] border-slate-900 pb-2">
        {profile.logo ? (
          <img src={profile.logo} alt="Logo Sekolah" className="h-16 w-16 object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Building2 className="h-7 w-7 text-emerald-700" />
          </div>
        )}
        <div className="flex-1 text-center">
          <div className="text-base font-bold uppercase tracking-tight text-slate-900">
            {profile.nama_sekolah || "SIMBARA SEKOLAH"}
          </div>
          {profile.npsn && <div className="text-xs text-slate-600">NPSN: {profile.npsn}</div>}
          <div className="text-[11px] leading-snug text-slate-600">{alamat || "Alamat sekolah belum diisi"}</div>
          {kontak && <div className="text-[11px] text-slate-600">{kontak}</div>}
        </div>
        <div className="h-16 w-16" aria-hidden />
      </div>
      <div className="mt-0.5 border-b border-slate-900" aria-hidden />
      <div className="mt-3 text-center">
        <div className="text-sm font-bold uppercase underline decoration-2 underline-offset-4 text-slate-900">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div>}
      </div>
    </div>
  );
}

// Blok tanda tangan: Mengetahui Kepala Sekolah + Pengurus Barang.
export function TandaTangan({ profile, tanggal }: { profile: SchoolProfile; tanggal: string }) {
  return (
    <div className="mt-8 flex justify-between px-2 text-xs text-slate-800">
      <div className="text-center">
        <div>Mengetahui,</div>
        <div>Kepala Sekolah</div>
        <div className="h-16" aria-hidden />
        <div className="font-semibold underline">{profile.kepala_sekolah || "………………………………"}</div>
        <div>NIP. {profile.nip_kepala || "………………"}</div>
      </div>
      <div className="text-center">
        <div>{tanggal}</div>
        <div>Pengurus Barang</div>
        <div className="h-16" aria-hidden />
        <div className="font-semibold underline">{profile.pengurus_barang || "………………………………"}</div>
        <div>NIP. {profile.nip_pengurus || "………………"}</div>
      </div>
    </div>
  );
}
