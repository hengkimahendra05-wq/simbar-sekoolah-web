import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { apiGet, apiPost, downloadFile } from "@/lib/api";
import { fmtAngka, fmtRp, fmtTanggal, fmtWaktu, hariIni, labelJenis, statusStok, toQS } from "@/lib/format";
import { useAuth, useSchoolProfile } from "@/lib/session";
import type { AuditEntry, Item, KartuStok, MutasiRow, Opname, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KopSurat, TandaTangan } from "@/components/kop-surat";

const KATEGORI = ["ATK", "Alat Kebersihan", "Meubelair", "Alat Elektronik", "Lainnya"];

interface Col {
  key: string;
  label: string;
  right?: boolean;
  mono?: boolean;
}
type Row = Record<string, string | number>;
interface Filters {
  awal: string;
  akhir: string;
  kategori: string;
  lokasi: string;
  jenis: string;
  itemId: string;
}
interface ReportData {
  columns: Col[];
  rows: Row[];
  footer?: Row;
}

const stokStatusLabel = (i: Item) => {
  const s = statusStok(i.stok, i.stok_minimum);
  return s === "habis" ? "Habis" : s === "menipis" ? "Menipis" : "Aman";
};

async function fetchItems(f: Filters, extra: Record<string, string> = {}) {
  return apiGet<Item[]>(`/items?${toQS({ kategori: f.kategori, lokasi: f.lokasi, jenis: f.jenis, ...extra })}`);
}

interface ReportDef {
  id: string;
  nama: string;
  build: (f: Filters) => Promise<ReportData>;
  needsPeriode?: boolean;
  needsKategori?: boolean;
  needsLokasi?: boolean;
  needsJenis?: boolean;
  needsItem?: boolean;
  adminOnly?: boolean;
  export: (f: Filters) => { path: string; params: Record<string, string> };
}

const REPORTS: ReportDef[] = [
  {
    id: "lap-rekap",
    nama: "Laporan Rekapitulasi Seluruh Barang",
    needsKategori: true,
    needsLokasi: true,
    needsJenis: true,
    build: async (f) => {
      const items = await fetchItems(f);
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "jenis", label: "Jenis" },
          { key: "kategori", label: "Kategori" },
          { key: "satuan", label: "Satuan" },
          { key: "stok", label: "Stok", right: true },
          { key: "lokasi", label: "Lokasi/Ruang" },
          { key: "kondisi", label: "Kondisi" },
        ],
        rows: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          jenis: labelJenis(i.jenis),
          kategori: i.kategori,
          satuan: i.satuan,
          stok: i.stok,
          lokasi: i.lokasi || "-",
          kondisi: i.kondisi,
        })),
      };
    },
    export: (f) => ({ path: "/export/barang", params: { kategori: f.kategori, lokasi: f.lokasi, jenis: f.jenis } }),
  },
  {
    id: "lap-persediaan",
    nama: "Laporan Posisi Stok Barang Persediaan",
    needsKategori: true,
    needsLokasi: true,
    build: async (f) => {
      const items = await fetchItems(f, { jenis: "persediaan" });
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "kategori", label: "Kategori" },
          { key: "satuan", label: "Satuan" },
          { key: "awal", label: "Stok Awal", right: true },
          { key: "stok", label: "Stok Sekarang", right: true },
          { key: "min", label: "Stok Minimum", right: true },
          { key: "status", label: "Status" },
          { key: "lokasi", label: "Lokasi/Ruang" },
        ],
        rows: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          kategori: i.kategori,
          satuan: i.satuan,
          awal: i.stok_awal,
          stok: i.stok,
          min: i.stok_minimum,
          status: stokStatusLabel(i),
          lokasi: i.lokasi || "-",
        })),
      };
    },
    export: (f) => ({ path: "/export/persediaan", params: { kategori: f.kategori, lokasi: f.lokasi } }),
  },
  {
    id: "lap-inventaris",
    nama: "Laporan Buku Inventaris Aset Tetap",
    needsKategori: true,
    needsLokasi: true,
    build: async (f) => {
      const items = await fetchItems(f, { jenis: "inventaris" });
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "tahun", label: "Tahun", right: true },
          { key: "kategori", label: "Kategori" },
          { key: "lokasi", label: "Lokasi/Ruang" },
          { key: "kondisi", label: "Kondisi" },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "harga", label: "Harga Satuan", right: true },
          { key: "nilai", label: "Nilai Total", right: true },
        ],
        rows: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          tahun: i.tahun ?? "-",
          kategori: i.kategori,
          lokasi: i.lokasi || "-",
          kondisi: i.kondisi,
          jumlah: i.stok,
          harga: i.harga_satuan,
          nilai: i.stok * i.harga_satuan,
        })),
        footer: { nama: "TOTAL NILAI ASET", jumlah: items.reduce((a, i) => a + i.stok, 0), nilai: items.reduce((a, i) => a + i.stok * i.harga_satuan, 0) },
      };
    },
    export: (f) => ({ path: "/export/inventaris", params: { kategori: f.kategori, lokasi: f.lokasi } }),
  },
  {
    id: "lap-masuk",
    nama: "Laporan Barang Masuk per Periode",
    needsPeriode: true,
    needsKategori: true,
    build: async (f) => {
      const txs = await apiGet<Transaction[]>(`/transactions?${toQS({ jenis: "masuk", tanggal_awal: f.awal, tanggal_akhir: f.akhir, kategori: f.kategori })}`);
      return {
        columns: [
          { key: "tanggal", label: "Tanggal" },
          { key: "nomor", label: "No. Transaksi", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "satuan", label: "Satuan" },
          { key: "harga", label: "Harga Satuan", right: true },
          { key: "total", label: "Total Harga", right: true },
          { key: "sumber", label: "Sumber Dana" },
        ],
        rows: txs.map((t) => ({
          tanggal: fmtTanggal(t.tanggal),
          nomor: t.nomor,
          nama: t.nama_barang,
          jumlah: t.jumlah,
          satuan: t.satuan,
          harga: t.harga_satuan,
          total: t.total_harga,
          sumber: t.sumber_dana || "-",
        })),
        footer: { nama: "TOTAL", jumlah: txs.reduce((a, t) => a + t.jumlah, 0), total: txs.reduce((a, t) => a + t.total_harga, 0) },
      };
    },
    export: (f) => ({ path: "/export/masuk", params: { tanggal_awal: f.awal, tanggal_akhir: f.akhir, kategori: f.kategori } }),
  },
  {
    id: "lap-keluar",
    nama: "Laporan Barang Keluar per Periode",
    needsPeriode: true,
    needsKategori: true,
    build: async (f) => {
      const txs = await apiGet<Transaction[]>(`/transactions?${toQS({ jenis: "keluar", tanggal_awal: f.awal, tanggal_akhir: f.akhir, kategori: f.kategori })}`);
      return {
        columns: [
          { key: "tanggal", label: "Tanggal" },
          { key: "nomor", label: "No. Transaksi", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "satuan", label: "Satuan" },
          { key: "penerima", label: "Penerima" },
          { key: "ket", label: "Keterangan" },
        ],
        rows: txs.map((t) => ({
          tanggal: fmtTanggal(t.tanggal),
          nomor: t.nomor,
          nama: t.nama_barang,
          jumlah: t.jumlah,
          satuan: t.satuan,
          penerima: t.penerima || "-",
          ket: t.keterangan || "-",
        })),
        footer: { nama: "TOTAL", jumlah: txs.reduce((a, t) => a + t.jumlah, 0) },
      };
    },
    export: (f) => ({ path: "/export/keluar", params: { tanggal_awal: f.awal, tanggal_akhir: f.akhir, kategori: f.kategori } }),
  },
  {
    id: "lap-mutasi",
    nama: "Laporan Mutasi Barang (Awal + Masuk − Keluar = Akhir)",
    needsPeriode: true,
    needsKategori: true,
    build: async (f) => {
      const rows = await apiGet<MutasiRow[]>(`/reports/mutasi?${toQS({ awal: f.awal, akhir: f.akhir })}`);
      const filtered = rows.filter((r) => (!f.kategori || r.kategori === f.kategori) && (!f.lokasi || r.lokasi === f.lokasi));
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "kategori", label: "Kategori" },
          { key: "satuan", label: "Satuan" },
          { key: "awal", label: "Stok Awal", right: true },
          { key: "masuk", label: "Masuk", right: true },
          { key: "keluar", label: "Keluar", right: true },
          { key: "akhir", label: "Stok Akhir", right: true },
        ],
        rows: filtered.map((r) => ({
          kode: r.kode,
          nama: r.nama,
          kategori: r.kategori,
          satuan: r.satuan,
          awal: r.stok_awal,
          masuk: r.masuk,
          keluar: r.keluar,
          akhir: r.stok_awal + r.masuk - r.keluar + r.penyesuaian,
        })),
      };
    },
    export: (f) => ({ path: "/export/barang", params: { kategori: f.kategori, lokasi: f.lokasi } }),
  },
  {
    id: "lap-kartu",
    nama: "Laporan Kartu Stok per Barang",
    needsItem: true,
    build: async (f) => {
      const k = await apiGet<KartuStok>(`/items/${f.itemId}/kartu-stok?${toQS({ awal: f.awal, akhir: f.akhir })}`);
      return {
        columns: [
          { key: "tanggal", label: "Tanggal" },
          { key: "nomor", label: "No. Transaksi", mono: true },
          { key: "ket", label: "Keterangan" },
          { key: "masuk", label: "Masuk", right: true },
          { key: "keluar", label: "Keluar", right: true },
          { key: "saldo", label: "Saldo", right: true },
        ],
        rows: [
          { tanggal: "—", nomor: "—", ket: `Saldo Awal (${k.item.kode} — ${k.item.nama})`, masuk: "—", keluar: "—", saldo: k.saldo_awal },
          ...k.rows.map((r) => ({
            tanggal: fmtTanggal(r.tanggal),
            nomor: r.nomor,
            ket: r.keterangan,
            masuk: r.masuk || "—",
            keluar: r.keluar || "—",
            saldo: r.saldo,
          })),
          { tanggal: "—", nomor: "—", ket: "Stok Akhir", masuk: k.total_masuk, keluar: k.total_keluar, saldo: k.saldo_akhir },
        ],
      };
    },
    export: (f) => ({ path: "/export/kartu-stok", params: { item_id: f.itemId, awal: f.awal, akhir: f.akhir } }),
  },
  {
    id: "lap-opname",
    nama: "Laporan Berita Acara Hasil Stok Opname",
    build: async () => {
      const ops = await apiGet<Opname[]>("/opnames");
      const rows: Row[] = [];
      for (const o of ops) {
        for (const d of o.details) {
          rows.push({
            nomor: o.nomor,
            tanggal: fmtTanggal(o.tanggal),
            lokasi: o.lokasi || "Semua",
            kode: d.kode,
            nama: d.nama,
            sistem: d.stok_sistem,
            fisik: d.stok_fisik,
            selisih: d.selisih > 0 ? `+${d.selisih}` : String(d.selisih),
            status: d.selisih === 0 ? "Sesuai" : d.selisih > 0 ? "Lebih" : "Kurang",
          });
        }
      }
      return {
        columns: [
          { key: "nomor", label: "No. Opname", mono: true },
          { key: "tanggal", label: "Tanggal" },
          { key: "lokasi", label: "Lokasi" },
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "sistem", label: "Sistem", right: true },
          { key: "fisik", label: "Fisik", right: true },
          { key: "selisih", label: "Selisih", right: true },
          { key: "status", label: "Status" },
        ],
        rows,
      };
    },
    export: () => ({ path: "/export/opname", params: {} }),
  },
  {
    id: "lap-kritis",
    nama: "Laporan Barang Stok Menipis & Habis",
    needsKategori: true,
    build: async (f) => {
      const [menipis, habis] = await Promise.all([
        fetchItems(f, { status: "menipis" }),
        fetchItems(f, { status: "habis" }),
      ]);
      const all = [...menipis, ...habis];
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "kategori", label: "Kategori" },
          { key: "satuan", label: "Satuan" },
          { key: "stok", label: "Stok", right: true },
          { key: "min", label: "Stok Minimum", right: true },
          { key: "status", label: "Status" },
          { key: "lokasi", label: "Lokasi/Ruang" },
        ],
        rows: all.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          kategori: i.kategori,
          satuan: i.satuan,
          stok: i.stok,
          min: i.stok_minimum,
          status: stokStatusLabel(i),
          lokasi: i.lokasi || "-",
        })),
      };
    },
    export: (f) => ({ path: "/export/barang", params: { status: "menipis", kategori: f.kategori } }),
  },
  {
    id: "lap-kondisi",
    nama: "Laporan Kondisi Barang & Usulan Penghapusan",
    needsKategori: true,
    needsLokasi: true,
    build: async (f) => {
      const items = await fetchItems(f);
      const rusak = items.filter((i) => i.kondisi !== "Baik");
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "jenis", label: "Jenis" },
          { key: "kondisi", label: "Kondisi" },
          { key: "tahun", label: "Tahun", right: true },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "lokasi", label: "Lokasi/Ruang" },
          { key: "usulan", label: "Usulan Tindak Lanjut" },
        ],
        rows: rusak.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          jenis: labelJenis(i.jenis),
          kondisi: i.kondisi,
          tahun: i.tahun ?? "-",
          jumlah: i.stok,
          lokasi: i.lokasi || "-",
          usulan: i.kondisi === "Rusak Berat" ? "Usulan penghapusan" : "Perbaikan / pemeliharaan",
        })),
      };
    },
    export: (f) => ({ path: "/export/barang", params: { kategori: f.kategori, lokasi: f.lokasi } }),
  },
  {
    id: "lap-ruang",
    nama: "Laporan Inventaris Barang per Ruangan (KIR)",
    needsLokasi: true,
    build: async (f) => {
      const items = await fetchItems(f);
      const sorted = [...items].sort((a, b) => (a.lokasi || "").localeCompare(b.lokasi || ""));
      return {
        columns: [
          { key: "lokasi", label: "Lokasi/Ruang" },
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "kategori", label: "Kategori" },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "satuan", label: "Satuan" },
          { key: "kondisi", label: "Kondisi" },
        ],
        rows: sorted.map((i) => ({
          lokasi: i.lokasi || "-",
          kode: i.kode,
          nama: i.nama,
          kategori: i.kategori,
          jumlah: i.stok,
          satuan: i.satuan,
          kondisi: i.kondisi,
        })),
      };
    },
    export: (f) => ({ path: "/export/barang", params: { lokasi: f.lokasi } }),
  },
  {
    id: "lap-valuasi",
    nama: "Laporan Nilai Persediaan & Aset",
    needsKategori: true,
    build: async (f) => {
      const items = await fetchItems(f);
      return {
        columns: [
          { key: "kode", label: "Kode", mono: true },
          { key: "nama", label: "Nama Barang" },
          { key: "jenis", label: "Jenis" },
          { key: "kategori", label: "Kategori" },
          { key: "jumlah", label: "Jumlah", right: true },
          { key: "satuan", label: "Satuan" },
          { key: "harga", label: "Harga Satuan", right: true },
          { key: "nilai", label: "Nilai Total", right: true },
        ],
        rows: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          jenis: labelJenis(i.jenis),
          kategori: i.kategori,
          jumlah: i.stok,
          satuan: i.satuan,
          harga: i.harga_satuan,
          nilai: i.stok * i.harga_satuan,
        })),
        footer: { nama: "TOTAL NILAI", nilai: items.reduce((a, i) => a + i.stok * i.harga_satuan, 0) },
      };
    },
    export: (f) => ({ path: "/export/barang", params: { kategori: f.kategori, jenis: f.jenis } }),
  },
  {
    id: "lap-audit",
    nama: "Laporan Riwayat Aktivitas Pengguna (Audit)",
    adminOnly: true,
    build: async () => {
      const logs = await apiGet<AuditEntry[]>("/audit?limit=500");
      return {
        columns: [
          { key: "waktu", label: "Waktu" },
          { key: "user", label: "Pengguna" },
          { key: "role", label: "Role" },
          { key: "aksi", label: "Aksi" },
          { key: "entitas", label: "Entitas" },
          { key: "detail", label: "Detail" },
        ],
        rows: logs.map((l) => ({
          waktu: fmtWaktu(l.waktu),
          user: l.user_name,
          role: l.role,
          aksi: l.aksi,
          entitas: l.entitas,
          detail: l.detail || "-",
        })),
      };
    },
    export: () => ({ path: "/export/audit", params: {} }),
  },
];

// Halaman Laporan: 13 jenis laporan dengan filter, kop surat, cetak/PDF, dan export Excel.
export default function Reports() {
  const { data: user } = useAuth();
  const { data: profile } = useSchoolProfile();
  const [reportId, setReportId] = useState("lap-rekap");
  const [awal, setAwal] = useState("");
  const [akhir, setAkhir] = useState("");
  const [kategori, setKategori] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [jenis, setJenis] = useState("");
  const [itemId, setItemId] = useState("");

  const def = REPORTS.find((r) => r.id === reportId)!;
  const visibleReports = REPORTS.filter((r) => !r.adminOnly || user?.role === "admin");
  const filters: Filters = { awal, akhir, kategori, lokasi, jenis, itemId };
  const enabled = !def.needsItem || Boolean(itemId);

  const { data: items } = useQuery({
    queryKey: ["items", "ref"],
    queryFn: () => apiGet<Item[]>("/items"),
    staleTime: 60_000,
    retry: false,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["laporan", reportId, filters],
    queryFn: () => def.build(filters),
    enabled,
    retry: false,
  });

  const print = async () => {
    try {
      await apiPost("/audit", { aksi: "Cetak", detail: `Laporan: ${def.nama}` });
    } catch {
      /* audit gagal tidak boleh menghalangi cetak */
    }
    window.print();
  };

  const periodeText =
    def.needsPeriode || def.needsItem
      ? `Periode: ${awal ? fmtTanggal(awal) : "Awal"} s.d. ${akhir ? fmtTanggal(akhir) : "Sekarang"}`
      : `Dicetak: ${fmtTanggal(hariIni())}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Laporan</h1>
          <p className="text-sm text-muted-foreground">
            {REPORTS.length} jenis laporan dengan kop surat otomatis dari profil sekolah.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={print} disabled={!data} data-testid="report-print-button">
            <Printer className="h-4 w-4" /> Cetak / PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const ex = def.export(filters);
              downloadFile(ex.path, ex.params);
            }}
            disabled={!def.needsItem || Boolean(itemId)}
            data-testid="report-export-button"
          >
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Kontrol laporan & filter */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-end" data-testid="report-controls">
        <div className="min-w-64 flex-1">
          <Label>Jenis Laporan</Label>
          <Select value={reportId} onValueChange={(v: string) => setReportId(v)}>
            <SelectTrigger data-testid="report-select">
              <SelectValue>{(v) => visibleReports.find((r) => r.id === v)?.nama ?? "Pilih Laporan"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {visibleReports.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(def.needsPeriode || def.needsItem) && (
          <>
            <div>
              <Label>Dari</Label>
              <Input type="date" value={awal} onChange={(e) => setAwal(e.target.value)} data-testid="report-filter-awal" />
            </div>
            <div>
              <Label>Sampai</Label>
              <Input type="date" value={akhir} onChange={(e) => setAkhir(e.target.value)} data-testid="report-filter-akhir" />
            </div>
          </>
        )}
        {def.needsKategori && (
          <div className="md:w-40">
            <Label>Kategori</Label>
            <Select value={kategori} onValueChange={(v: string) => setKategori(v)}>
              <SelectTrigger data-testid="report-filter-kategori">
                <SelectValue>{(v) => (v ? v : "Semua")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KATEGORI.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {def.needsJenis && (
          <div className="md:w-40">
            <Label>Jenis Barang</Label>
            <Select value={jenis} onValueChange={(v: string) => setJenis(v)}>
              <SelectTrigger data-testid="report-filter-jenis">
                <SelectValue>{(v) => (v ? labelJenis(v) : "Semua")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persediaan">Persediaan</SelectItem>
                <SelectItem value="inventaris">Inventaris/Aset</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {def.needsLokasi && (
          <div className="md:w-44">
            <Label>Lokasi</Label>
            <Input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="cth. Gudang Utama" data-testid="report-filter-lokasi" />
          </div>
        )}
        {def.needsItem && (
          <div className="min-w-56 flex-1">
            <Label>Barang</Label>
            <Select value={itemId} onValueChange={(v: string) => setItemId(v)}>
              <SelectTrigger data-testid="report-filter-item">
                <SelectValue>
                  {(v) => {
                    const it = (items ?? []).find((i) => i.id === v);
                    return it ? `${it.kode} — ${it.nama}` : "Pilih Barang";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(items ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.kode} — {i.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Pratinjau laporan */}
      {def.needsItem && !itemId ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground" data-testid="report-empty-item">
          Pilih barang terlebih dahulu untuk menampilkan laporan kartu stok.
        </div>
      ) : (
        <Card className="p-0" data-testid="report-preview">
          <CardContent className="p-4 md:p-6">
            <div className="print-area rounded-lg bg-white p-4 text-slate-900 md:p-6">
              {profile && <KopSurat profile={profile} title={def.nama.toUpperCase()} subtitle={periodeText} />}
              {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Menyusun laporan…</div>}
              {isError && (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="report-error">
                  Gagal memuat data laporan. Periksa filter lalu coba lagi.
                </div>
              )}
              {data && (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          {data.columns.map((c) => (
                            <TableHead key={c.key} className={c.right ? "text-right" : ""}>
                              {c.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rows.map((row, i) => (
                          // Key stabil dari data (kode/nomor/item_id) — index hanya cadangan terakhir.
                          <TableRow
                            key={String(row.kode ?? row.nomor ?? row.item_id ?? i)}
                            data-testid={`report-row-${i}`}
                          >
                            {data.columns.map((c) => (
                              <TableCell
                                key={c.key}
                                className={`${c.right ? "text-right tabular-nums" : ""} ${c.mono ? "font-mono text-xs" : "text-sm"}`}
                              >
                                {c.key === "harga" || c.key === "nilai" || c.key === "total"
                                  ? fmtRp(Number(row[c.key]) || 0)
                                  : c.key === "stok" || c.key === "jumlah" || c.key === "masuk" || c.key === "keluar" || c.key === "saldo" || c.key === "awal" || c.key === "akhir" || c.key === "min" || c.key === "sistem" || c.key === "fisik"
                                    ? fmtAngka(Number(row[c.key]))
                                    : String(row[c.key] ?? "-")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {data.rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={data.columns.length} className="py-8 text-center text-sm text-muted-foreground">
                              Tidak ada data untuk laporan ini.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                      {data.footer && (
                        <TableFooter>
                          <TableRow className="bg-slate-100 font-semibold">
                            {data.columns.map((c) => {
                              const v = data.footer![c.key];
                              return (
                                <TableCell key={c.key} className={`text-sm ${c.right ? "text-right tabular-nums" : ""}`}>
                                  {v === undefined
                                    ? c.key === "nama"
                                      ? ""
                                      : ""
                                    : c.key === "nilai" || c.key === "total"
                                      ? fmtRp(Number(v))
                                      : c.key === "nama"
                                        ? String(v)
                                        : fmtAngka(Number(v))}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                  {profile && <TandaTangan profile={profile} tanggal={fmtTanggal(hariIni())} />}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
