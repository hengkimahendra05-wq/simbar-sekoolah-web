import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileUp } from "lucide-react";
import { apiGet, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Menu Export Excel: unduh seluruh tabel utama dalam format .xlsx rapi siap cetak.
export default function ExportPage() {
  const { data: user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: items } = useQuery({
    queryKey: ["items", "ref"],
    queryFn: () => apiGet<unknown[]>("/items"),
    staleTime: 60_000,
    retry: false,
  });
  const itemCount = items?.length ?? 0;

  const EXPORTS: { title: string; desc: string; path: string; testid: string; adminOnly?: boolean }[] = [
    { title: "Data Barang", desc: `Seluruh master data barang beserta stok saat ini (${itemCount} barang aktif).`, path: "/export/barang", testid: "export-barang" },
    { title: "Barang Persediaan", desc: "Posisi stok barang habis pakai: ATK, alat kebersihan, dan konsumtif.", path: "/export/persediaan", testid: "export-persediaan" },
    { title: "Inventaris / Aset", desc: "Buku inventaris aset tetap: meubelair, elektronik, dan perlengkapan.", path: "/export/inventaris", testid: "export-inventaris" },
    { title: "Barang Masuk", desc: "Riwayat seluruh transaksi penerimaan / pengadaan barang.", path: "/export/masuk", testid: "export-masuk" },
    { title: "Barang Keluar", desc: "Riwayat seluruh transaksi pemakaian / distribusi barang.", path: "/export/keluar", testid: "export-keluar" },
    { title: "Stok Opname", desc: "Hasil pemeriksaan fisik beserta selisih dan statusnya.", path: "/export/opname", testid: "export-opname" },
    { title: "Template Import", desc: "Template Excel untuk import data barang (format kolom resmi).", path: "/export/template-import", testid: "export-template" },
    { title: "Data Pengguna", desc: "Daftar akun pengguna aplikasi.", path: "/export/pengguna", testid: "export-pengguna", adminOnly: true },
    { title: "Riwayat Aktivitas", desc: "Audit trail seluruh aktivitas pengguna.", path: "/export/audit", testid: "export-audit", adminOnly: true },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Export Excel</h1>
        <p className="text-sm text-muted-foreground">
          Unduh data dalam format .xlsx dengan kop sekolah, judul tabel, dan baris berbingkai — siap dicetak.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="export-grid">
        {EXPORTS.filter((e) => !e.adminOnly || isAdmin).map((e) => (
          <Card key={e.title} className="flex flex-col justify-between" data-testid={e.testid}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  {e.adminOnly ? <FileUp className="h-4.5 w-4.5" /> : <FileSpreadsheet className="h-4.5 w-4.5" />}
                </span>
                <CardTitle className="text-sm">{e.title}</CardTitle>
              </div>
              <CardDescription className="pt-1 text-xs">{e.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full" onClick={() => downloadFile(e.path)} data-testid={`${e.testid}-button`}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Untuk export dengan filter tertentu (kategori, periode tanggal, status), gunakan tombol “Export Excel” di
        halaman tabel terkait — filter aktif akan ikut diterapkan pada file.
      </p>
    </div>
  );
}
