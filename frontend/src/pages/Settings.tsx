import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Database, Download, FileSpreadsheet, History, Info, Upload, UserRound, Users } from "lucide-react";
import { apiGet, downloadFile } from "@/lib/api";
import { labelRole } from "@/lib/format";
import { useAuth, useSchoolProfile } from "@/lib/session";
import type { DashboardData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// Pengaturan: pintasan konfigurasi, cadangan data, dan informasi aplikasi.
export default function Settings() {
  const { data: user } = useAuth();
  const { data: profile } = useSchoolProfile();
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/dashboard"),
    retry: false,
  });
  const isAdmin = user?.role === "admin";

  const shortcuts = [
    { to: "/profil-sekolah", icon: Building2, title: "Profil Sekolah", desc: "Identitas & kop laporan" },
    { to: "/profil", icon: UserRound, title: "Profil Saya", desc: "Nama, foto, dan password" },
    ...(isAdmin ? [{ to: "/pengguna", icon: Users, title: "Manajemen Pengguna", desc: "Akun & hak akses" }] : []),
    ...(isAdmin ? [{ to: "/riwayat", icon: History, title: "Riwayat Aktivitas", desc: "Audit trail pengguna" }] : []),
    { to: "/import", icon: Upload, title: "Import Excel", desc: "Isi data barang dari file" },
    { to: "/export", icon: Download, title: "Export Excel", desc: "Unduh seluruh tabel" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi aplikasi, cadangan data, dan informasi sistem.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="settings-shortcuts">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-transform hover:-translate-y-0.5"
              data-testid={`settings-link-${s.to.replace("/", "")}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="settings-backup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-emerald-700" /> Cadangan Data (Backup)
            </CardTitle>
            <CardDescription>
              Unduh seluruh data utama sebagai file Excel untuk disimpan sebagai arsip sekolah.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Data Barang", path: "/export/barang", testid: "settings-backup-barang" },
              { label: "Barang Masuk", path: "/export/masuk", testid: "settings-backup-masuk" },
              { label: "Barang Keluar", path: "/export/keluar", testid: "settings-backup-keluar" },
              { label: "Stok Opname", path: "/export/opname", testid: "settings-backup-opname" },
            ].map((b) => (
              <Button key={b.path} variant="outline" size="sm" onClick={() => downloadFile(b.path)} data-testid={b.testid}>
                <FileSpreadsheet className="h-4 w-4" /> {b.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="settings-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-700" /> Informasi Aplikasi
            </CardTitle>
            <CardDescription>Ringkasan sistem dan data tersimpan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Nama Aplikasi", "SIMBARA SEKOLAH"],
              ["Deskripsi", "Sistem Informasi Manajemen Barang Sekolah"],
              ["Sekolah", profile?.nama_sekolah || "Belum diisi"],
              ["NPSN", profile?.npsn || "-"],
              ["Pengguna Aktif", `${user?.nama ?? "-"} (${user ? labelRole(user.role) : "-"})`],
              ["Total Jenis Barang", String(dash?.total_jenis ?? "-")],
              ["Total Unit Stok", String(dash?.total_unit ?? "-")],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">Perhitungan Stok</span>
              <Badge className="bg-emerald-100 text-emerald-800">Otomatis dari histori transaksi</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
        <b>Catatan:</b> Stok setiap barang selalu dihitung ulang dari histori transaksi (Stok Awal + Barang Masuk −
        Barang Keluar), sehingga data stok tidak pernah tidak sinkron dengan riwayat transaksi. Penyesuaian stok hanya
        dapat dilakukan melalui menu{" "}
        <Link to="/stok-opname" className="font-semibold underline">
          Stok Opname
        </Link>
        .
      </div>
    </div>
  );
}
