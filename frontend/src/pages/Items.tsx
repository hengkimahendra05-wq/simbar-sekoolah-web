import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, Eye, Package, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { apiDelete, apiGet, downloadFile } from "@/lib/api";
import { errMsg, fmtRp, fmtWaktu, labelJenis, statusStok, toQS } from "@/lib/format";
import type { Item, ItemPage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDialog from "@/components/confirm-dialog";
import ImportSection from "@/components/import-section";
import ItemFormDialog from "@/components/item-form-dialog";

const PER_PAGE = 10;
const KATEGORI = ["ATK", "Alat Kebersihan", "Meubelair", "Alat Elektronik", "Lainnya"];
const KONDISI = ["Baik", "Rusak Ringan", "Rusak Berat"];

function KondisiBadge({ kondisi }: { kondisi: string }) {
  const cls =
    kondisi === "Rusak Berat"
      ? "bg-rose-100 text-rose-800"
      : kondisi === "Rusak Ringan"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
  return <Badge className={cls}>{kondisi}</Badge>;
}

function StokBadge({ item }: { item: Item }) {
  const s = statusStok(item.stok, item.stok_minimum);
  if (s === "habis") return <Badge className="bg-rose-100 text-rose-800">Habis</Badge>;
  if (s === "menipis") return <Badge className="bg-amber-100 text-amber-800">Menipis</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800">Aman</Badge>;
}

interface Props {
  jenis?: "persediaan" | "inventaris";
}

// Halaman Data Barang — dipakai untuk Semua Barang, Persediaan, dan Inventaris/Aset.
export default function Items({ jenis }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [kategori, setKategori] = useState("");
  const [kondisi, setKondisi] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("nama");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const qc = useQueryClient();

  const params = { q, jenis: jenis ?? "", kategori, kondisi, lokasi, status, sort, dir, page, per_page: PER_PAGE };
  // Server-side search + pagination: query dijalankan di database (tetap cepat pada puluhan ribu barang).
  const { data: pageData, isLoading } = useQuery({
    queryKey: ["items", "paged", params],
    queryFn: () => apiGet<ItemPage>(`/items/paged?${toQS(params)}`),
    retry: false,
  });
  const { data: allItems } = useQuery({
    queryKey: ["items", "lokasi-ref"],
    queryFn: () => apiGet<Item[]>("/items"),
    staleTime: 60_000,
    retry: false,
  });
  const lokasiOptions = useMemo(
    () => [...new Set((allItems ?? []).map((i) => i.lokasi).filter(Boolean))].sort(),
    [allItems],
  );

  // Parameter dari aksi cepat / notifikasi / pencarian global.
  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    let changed = false;
    if (p.get("new") === "1") {
      setEditing(null);
      setFormOpen(true);
      p.delete("new");
      changed = true;
    }
    if (p.get("status")) {
      setStatus(p.get("status")!);
      p.delete("status");
      changed = true;
    }
    if (p.get("q")) {
      setQ(p.get("q")!);
      p.delete("q");
      changed = true;
    }
    if (changed) setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [q, kategori, kondisi, lokasi, status, sort, dir]);

  const rows = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const pages = pageData?.pages ?? 1;
  const current = pageData?.page ?? 1;

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ archived: boolean; message: string }>(`/items/${id}`),
    onSuccess: (res) => {
      toast.success(res.message);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const title = jenis === "persediaan" ? "Data Barang Persediaan" : jenis === "inventaris" ? "Data Barang Inventaris/Aset" : "Semua Barang";
  const subtitle =
    jenis === "persediaan"
      ? "Barang habis pakai: ATK, alat kebersihan, dan konsumtif lainnya"
      : jenis === "inventaris"
        ? "Aset tetap sekolah: meubelair, elektronik, dan perlengkapan"
        : "Master data seluruh barang milik sekolah";

  const sortBtn = (key: string, label: string) => (
    <button
      onClick={() => {
        if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
        else {
          setSort(key);
          setDir("asc");
        }
      }}
      className="inline-flex items-center gap-1 hover:text-emerald-700"
      data-testid={`item-sort-${key}`}
    >
      {label} {sort === key && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  const hasFilter = Boolean(q || kategori || kondisi || lokasi || status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="item-import-button">
            <Upload className="h-4 w-4" /> Import Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadFile("/export/barang", { q, jenis: jenis ?? "", kategori, kondisi, lokasi, status })}
            data-testid="item-export-button"
          >
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            data-testid="item-add-button"
          >
            <Plus className="h-4 w-4" /> Tambah Barang
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama barang / kode… (cth. Kertas A4)"
            className="pl-8"
            data-testid="item-search-input"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={kategori} onValueChange={(v: string) => setKategori(v)}>
            <SelectTrigger data-testid="item-filter-kategori">
              <SelectValue>{(v) => (v ? v : "Semua Kategori")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {KATEGORI.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kondisi} onValueChange={(v: string) => setKondisi(v)}>
            <SelectTrigger data-testid="item-filter-kondisi">
              <SelectValue>{(v) => (v ? v : "Semua Kondisi")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {KONDISI.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lokasi} onValueChange={(v: string) => setLokasi(v)}>
            <SelectTrigger data-testid="item-filter-lokasi">
              <SelectValue>{(v) => (v ? v : "Semua Lokasi")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {lokasiOptions.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v: string) => setStatus(v)}>
            <SelectTrigger data-testid="item-filter-status">
              <SelectValue>{(v) => (v === "menipis" ? "Stok Menipis" : v === "habis" ? "Stok Habis" : v === "arsip" ? "Arsip" : "Semua Status")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menipis">Stok Menipis</SelectItem>
              <SelectItem value="habis">Stok Habis</SelectItem>
              <SelectItem value="arsip">Arsip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setKategori("");
              setKondisi("");
              setLokasi("");
              setStatus("");
            }}
            data-testid="item-filter-reset"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border bg-card" data-testid="item-table">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>{sortBtn("kode", "Kode")}</TableHead>
              <TableHead>{sortBtn("nama", "Nama Barang")}</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">{sortBtn("stok", "Stok")}</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Kondisi</TableHead>
              <TableHead>{sortBtn("tahun", "Tahun")}</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat data…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              rows.map((it, idx) => (
                <TableRow key={it.id} className={cn(idx % 2 === 1 && "bg-slate-50/50")} data-testid={`item-row-${it.kode}`}>
                  <TableCell className="font-mono text-xs">{it.kode}</TableCell>
                  <TableCell className="max-w-64">
                    <div className="truncate text-sm font-medium text-slate-900">{it.nama}</div>
                    {it.archived && <Badge variant="outline" className="mt-0.5 text-[10px]">Diarsipkan</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={it.jenis === "inventaris" ? "secondary" : "outline"} className="text-[11px]">
                      {labelJenis(it.jenis)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{it.kategori}</TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {it.stok} <span className="text-xs font-normal text-muted-foreground">{it.satuan}</span>
                    </div>
                    <StokBadge item={it} />
                  </TableCell>
                  <TableCell className="max-w-36 truncate text-sm">{it.lokasi || "-"}</TableCell>
                  <TableCell>
                    <KondisiBadge kondisi={it.kondisi} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{it.tahun ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={() => setDetail(it)} title="Detail" data-testid={`item-detail-button-${it.kode}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setEditing(it);
                          setFormOpen(true);
                        }}
                        title="Edit"
                        data-testid={`item-edit-button-${it.kode}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(it)} title="Hapus" className="text-rose-600 hover:text-rose-700" data-testid={`item-delete-button-${it.kode}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground" data-testid="item-empty">
                  <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  {hasFilter ? "Tidak ada barang yang cocok dengan filter." : "Belum ada data barang. Klik “Tambah Barang” untuk memulai."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="item-pagination">
        <span data-testid="item-pagination-info">
          {total === 0 ? "0 data" : `Menampilkan ${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, total)} dari ${total} data`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} data-testid="item-pagination-prev">
            Sebelumnya
          </Button>
          <span className="text-xs">
            Hal. {current}/{pages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} data-testid="item-pagination-next">
            Berikutnya
          </Button>
        </div>
      </div>

      {/* Dialog form tambah/edit */}
      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} lokasiOptions={lokasiOptions} />

      {/* Dialog detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="item-detail-dialog">
          <DialogHeader>
            <DialogTitle>Detail Barang</DialogTitle>
            <DialogDescription className="font-mono text-xs">{detail?.kode}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {[
                ["Nama Barang", detail.nama],
                ["Jenis", labelJenis(detail.jenis)],
                ["Kategori", detail.kategori],
                ["Satuan", detail.satuan],
                ["Tahun Perolehan", detail.tahun ? String(detail.tahun) : "-"],
                ["Lokasi/Ruang", detail.lokasi || "-"],
                ["Kondisi", detail.kondisi],
                ["Stok Awal", `${detail.stok_awal} ${detail.satuan}`],
                ["Stok Saat Ini", `${detail.stok} ${detail.satuan}`],
                ["Stok Minimum", `${detail.stok_minimum} ${detail.satuan}`],
                ["Harga Satuan", detail.harga_satuan ? fmtRp(detail.harga_satuan) : "-"],
                ["Terakhir Diubah", fmtWaktu(detail.updated_at)],
                ["Keterangan", detail.keterangan || "-"],
              ].map(([k, v]) => (
                <div key={k} className={k === "Keterangan" ? "col-span-2" : ""}>
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-medium text-slate-800">{v}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Hapus ${deleting?.nama ?? "Barang"}?`}
        description={
          deleting
            ? `Barang dengan kode ${deleting.kode} akan dihapus. Jika barang memiliki riwayat transaksi, barang akan DIARSIPKAN (bukan dihapus permanen) agar histori tetap aman.`
            : ""
        }
        confirmLabel="Ya, Hapus"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />

      {/* Dialog import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="item-import-dialog">
          <DialogHeader>
            <DialogTitle>Import Data Barang dari Excel</DialogTitle>
            <DialogDescription>
              Unggah file, periksa pratinjau validasi, pilih penanganan duplikat, lalu tekan Import.
            </DialogDescription>
          </DialogHeader>
          <ImportSection />
        </DialogContent>
      </Dialog>
    </div>
  );
}
