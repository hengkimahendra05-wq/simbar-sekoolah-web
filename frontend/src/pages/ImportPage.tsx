import { ClipboardPaste, Download, FileCheck2, ListChecks, Scale } from "lucide-react";
import ImportSection from "@/components/import-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Menu Import Excel: panduan singkat + alur lengkap (template → unggah → pratinjau → import).
export default function ImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Import Excel</h1>
        <p className="text-sm text-muted-foreground">
          Isi master data barang dari file .xlsx, .xls, atau .csv — dengan pratinjau dan validasi sebelum disimpan.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Alur Import</CardTitle>
            <CardDescription>Ikuti langkah berikut — data hanya tersimpan setelah Anda menekan tombol Import.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yang Perlu Diketahui</CardTitle>
            <CardDescription>Validasi yang dilakukan sistem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex gap-2.5">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b>Kolom wajib:</b> Nama Barang. Kolom lain boleh kosong dan memakai nilai bawaan.
              </span>
            </div>
            <div className="flex gap-2.5">
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b>Duplikat</b> terdeteksi dari Kode Barang, atau kombinasi Nama + Kategori yang sama.
              </span>
            </div>
            <div className="flex gap-2.5">
              <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b>Pratinjau</b> menandai baris error (merah) dan duplikat (kuning) sebelum data disimpan.
              </span>
            </div>
            <div className="flex gap-2.5">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b>Stok</b> hasil import menjadi Stok Awal — stok saat ini dihitung ulang otomatis dari histori transaksi.
              </span>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
              Kategori yang dikenal: ATK, Alat Kebersihan, Meubelair, Alat Elektronik, Lainnya. Kondisi: Baik, Rusak
              Ringan, Rusak Berat. Jenis: Persediaan atau Inventaris.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
