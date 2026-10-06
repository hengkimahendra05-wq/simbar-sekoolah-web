import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Download, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut, downloadFile } from "@/lib/api";
import { errMsg, fmtRp, fmtTanggal, hariIni, toQS } from "@/lib/format";
import type {
  Item,
  Transaction,
  TransactionBatchLine,
  TransactionInput,
  TransactionPage,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/confirm-dialog";

const PER_PAGE = 10;
const KATEGORI = ["ATK", "Alat Kebersihan", "Meubelair", "Alat Elektronik", "Lainnya"];
const SUMBER_DANA = ["BOS Reguler", "BOS Kinerja", "Komite", "Hibah", "Lainnya"];
const KONDISI = ["Baik", "Rusak Ringan", "Rusak Berat"];

const EMPTY: TransactionInput = {
  jenis: "",
  tanggal: hariIni(),
  item_id: "",
  jumlah: 1,
  harga_satuan: 0,
  sumber_dana: "BOS Reguler",
  nomor_dokumen: "",
  tujuan: "",
  penerima: "",
  keperluan: "",
  kondisi: "Baik",
  lokasi: "",
  keterangan: "",
};

// Baris form memakai `uid` stabil sebagai key React — index sebagai key membuat state input
// pindah/hilang saat satu baris dihapus.
type LineRow = TransactionBatchLine & { uid: string };

const newLine = (): LineRow => ({
  uid: crypto.randomUUID(),
  item_id: "",
  jumlah: 1,
  harga_satuan: 0,
  keterangan: "",
});

interface Props {
  jenis: "masuk" | "keluar";
}

// Halaman Barang Masuk & Barang Keluar — stok master otomatis dihitung ulang dari histori.
export default function Transactions({ jenis }: Props) {
  const isMasuk = jenis === "masuk";
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("");
  const [awal, setAwal] = useState("");
  const [akhir, setAkhir] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput>({ ...EMPTY, jenis });
  // Barang keluar: satu transaksi bisa memuat beberapa jenis barang sekaligus.
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const qc = useQueryClient();
  const multi = !isMasuk && !editing;

  const listParams = { jenis, q, kategori, tanggal_awal: awal, tanggal_akhir: akhir, page, per_page: PER_PAGE };
  // Server-side pagination + pencarian database (§AC).
  const { data: pageData, isLoading } = useQuery({
    queryKey: ["transactions", "paged", listParams],
    queryFn: () => apiGet<TransactionPage>(`/transactions/paged?${toQS(listParams)}`),
    retry: false,
  });
  const { data: items } = useQuery({
    queryKey: ["items", "ref"],
    queryFn: () => apiGet<Item[]>("/items"),
    staleTime: 60_000,
    retry: false,
  });
  const itemMap = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const selectedItem = form.item_id ? itemMap.get(form.item_id) : undefined;

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setForm({ ...EMPTY, jenis });
      setLines([newLine()]);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, jenis]);

  useEffect(() => {
    setPage(1);
  }, [q, kategori, awal, akhir]);

  const rows = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const pages = pageData?.pages ?? 1;
  const current = pageData?.page ?? 1;
  const totalUnit = pageData?.total_unit ?? 0;
  const totalNilai = pageData?.total_nilai ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["kartu-stok"] });
  };

  const save = useMutation({
    mutationFn: () => {
      if (editing) return apiPut<Transaction>(`/transactions/${editing.id}`, form).then((t) => [t]);
      if (multi)
        return apiPost<Transaction[]>("/transactions/batch", {
          jenis,
          tanggal: form.tanggal,
          penerima: form.penerima,
          keperluan: form.keperluan,
          tujuan: form.tujuan,
          nomor_dokumen: form.nomor_dokumen,
          sumber_dana: form.sumber_dana,
          lokasi: form.lokasi,
          kondisi: form.kondisi,
          keterangan: form.keterangan,
          lines: filledLines.map(({ item_id, jumlah, harga_satuan, keterangan }) => ({
            item_id,
            jumlah,
            harga_satuan,
            keterangan,
          })),
        });
      return apiPost<Transaction>("/transactions", { ...form, jenis }).then((t) => [t]);
    },
    onSuccess: (res) => {
      const count = res.length;
      toast.success(
        editing
          ? "Transaksi diperbarui — stok dihitung ulang otomatis"
          : `Transaksi tersimpan (${count} jenis barang) — stok barang diperbarui otomatis`,
      );
      invalidate();
      setFormOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ message: string }>(`/transactions/${id}`),
    onSuccess: (r) => {
      toast.success(r.message);
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, jenis });
    setLines([newLine()]);
    setFormOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      jenis: t.jenis,
      tanggal: t.tanggal,
      item_id: t.item_id,
      jumlah: t.jumlah,
      harga_satuan: t.harga_satuan,
      sumber_dana: t.sumber_dana || "Lainnya",
      nomor_dokumen: t.nomor_dokumen,
      tujuan: t.tujuan,
      penerima: t.penerima,
      keperluan: t.keperluan,
      kondisi: t.kondisi || "Baik",
      lokasi: t.lokasi,
      keterangan: t.keterangan,
    });
    setFormOpen(true);
  };

  const setLine = (idx: number, patch: Partial<TransactionBatchLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, newLine()]);
  const removeLine = (idx: number) => setLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)));
  const filledLines = lines.filter((l) => l.item_id && l.jumlah > 0);
  const multiValid = filledLines.length > 0;

  const submit = () => {
    if (multi) {
      if (!multiValid) {
        toast.error("Tambahkan minimal satu barang dengan jumlah yang benar");
        return;
      }
      // Validasi klien — backend memvalidasi ulang (sumber kebenaran tetap server).
      const totalPerItem = new Map<string, number>();
      for (const l of filledLines) totalPerItem.set(l.item_id, (totalPerItem.get(l.item_id) ?? 0) + l.jumlah);
      for (const [id, jml] of totalPerItem) {
        const it = itemMap.get(id);
        if (it && jml > it.stok) {
          toast.error(`Stok ${it.nama} tidak mencukupi (stok saat ini: ${it.stok} ${it.satuan})`);
          return;
        }
      }
      save.mutate();
      return;
    }
    if (!form.item_id) {
      toast.error("Pilih barang terlebih dahulu");
      return;
    }
    if (form.jumlah < 1) {
      toast.error("Jumlah minimal 1");
      return;
    }
    if (!isMasuk && selectedItem && form.jumlah > selectedItem.stok) {
      toast.error(`Stok tidak mencukupi (stok saat ini: ${selectedItem.stok} ${selectedItem.satuan})`);
      return;
    }
    save.mutate();
  };

  const totalHarga = form.jumlah * form.harga_satuan;
  const hasFilter = Boolean(q || kategori || awal || akhir);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            {isMasuk ? <ArrowDownToLine className="h-6 w-6 text-emerald-600" /> : <ArrowUpFromLine className="h-6 w-6 text-amber-600" />}
            {isMasuk ? "Barang Masuk" : "Barang Keluar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isMasuk
              ? "Catat pengadaan / penerimaan barang — stok otomatis bertambah"
              : "Catat pemakaian / distribusi barang — stok otomatis berkurang"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => downloadFile(`/export/${jenis}`, { q, kategori, tanggal_awal: awal, tanggal_akhir: akhir })}
            data-testid="transaction-export-button"
          >
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={openCreate} data-testid="transaction-add-button">
            <Plus className="h-4 w-4" /> {isMasuk ? "Catat Barang Masuk" : "Catat Barang Keluar"}
          </Button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3" data-testid="transaction-summary">
        {[
          { label: "Jumlah Transaksi", value: String(total) },
          { label: "Total Unit", value: `${totalUnit} unit` },
          ...(isMasuk ? [{ label: "Total Nilai", value: fmtRp(totalNilai) }] : []),
          ...(!isMasuk ? [{ label: "Halaman", value: `${current}/${pages}` }] : []),
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="font-heading text-lg font-bold tabular-nums text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor / nama barang / penerima…"
            className="pl-8"
            data-testid="transaction-search-input"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div>
            <Input type="date" value={awal} onChange={(e) => setAwal(e.target.value)} aria-label="Tanggal awal" data-testid="transaction-filter-awal" />
          </div>
          <div>
            <Input type="date" value={akhir} onChange={(e) => setAkhir(e.target.value)} aria-label="Tanggal akhir" data-testid="transaction-filter-akhir" />
          </div>
          <Select value={kategori} onValueChange={(v: string) => setKategori(v)}>
            <SelectTrigger data-testid="transaction-filter-kategori">
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
        </div>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setKategori("");
              setAwal("");
              setAkhir("");
            }}
            data-testid="transaction-filter-reset"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border bg-card" data-testid="transaction-table">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Transaksi</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">{isMasuk ? "Total Harga" : "Penerima"}</TableHead>
              <TableHead>Petugas</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat data…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              rows.map((t, idx) => (
                <TableRow key={t.id} className={cn(idx % 2 === 1 && "bg-slate-50/50")} data-testid={`transaction-row-${t.nomor}`}>
                  <TableCell className="whitespace-nowrap text-sm">{fmtTanggal(t.tanggal)}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{t.nomor}</TableCell>
                  <TableCell>
                    <div className="max-w-56 truncate text-sm font-medium">{t.nama_barang}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{t.kode_barang}</div>
                  </TableCell>
                  <TableCell className="text-sm">{t.kategori}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {t.jumlah} <span className="text-xs font-normal text-muted-foreground">{t.satuan}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {isMasuk ? (
                      <span className="font-semibold tabular-nums">{fmtRp(t.total_harga)}</span>
                    ) : (
                      <span className="max-w-40 truncate">{t.penerima || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{t.user_name}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={() => setDetail(t)} title="Detail" data-testid={`transaction-detail-button-${t.nomor}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(t)} title="Edit" data-testid={`transaction-edit-button-${t.nomor}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(t)} title="Hapus" className="text-rose-600 hover:text-rose-700" data-testid={`transaction-delete-button-${t.nomor}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground" data-testid="transaction-empty">
                  Belum ada transaksi{hasFilter ? " yang cocok dengan filter" : isMasuk ? " masuk" : " keluar"}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="transaction-pagination">
        <span>
          {total === 0 ? "0 data" : `Menampilkan ${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, total)} dari ${total} data`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} data-testid="transaction-pagination-prev">
            Sebelumnya
          </Button>
          <span className="text-xs">
            Hal. {current}/{pages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} data-testid="transaction-pagination-next">
            Berikutnya
          </Button>
        </div>
      </div>

      {/* Form tambah/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="transaction-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Transaksi" : isMasuk ? "Catat Barang Masuk" : "Catat Barang Keluar"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Mengubah transaksi akan menghitung ulang stok barang otomatis berdasarkan histori."
                : isMasuk
                  ? "Stok barang otomatis bertambah setelah transaksi disimpan."
                  : "Satu transaksi dapat memuat beberapa jenis barang. Stok setiap barang otomatis berkurang setelah disimpan."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tx-tanggal">Tanggal *</Label>
                <Input
                  id="tx-tanggal"
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                  data-testid="transaction-form-input-tanggal"
                />
              </div>
              {!multi && (
                <div>
                  <Label htmlFor="tx-jumlah">Jumlah *</Label>
                  <Input
                    id="tx-jumlah"
                    type="number"
                    min={1}
                    value={form.jumlah}
                    onChange={(e) => setForm((f) => ({ ...f, jumlah: Number(e.target.value) || 0 }))}
                    data-testid="transaction-form-input-jumlah"
                  />
                </div>
              )}
            </div>

            {multi && (
              <div className="space-y-2" data-testid="transaction-form-lines">
                <div className="flex items-center justify-between">
                  <Label>Daftar Barang Keluar *</Label>
                  <Button variant="outline" size="sm" onClick={addLine} data-testid="transaction-form-add-line-button">
                    <Plus className="h-4 w-4" /> Tambah Barang
                  </Button>
                </div>
                {lines.map((line, idx) => {
                  const it = line.item_id ? itemMap.get(line.item_id) : undefined;
                  const kurang = Boolean(it && line.jumlah > it.stok);
                  return (
                    <div
                      key={line.uid}
                      className="rounded-lg border bg-slate-50/60 p-2.5"
                      data-testid={`transaction-form-line-${idx}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-2.5 w-5 text-xs font-bold tabular-nums text-muted-foreground">{idx + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <Select value={line.item_id} onValueChange={(v: string) => setLine(idx, { item_id: v })}>
                            <SelectTrigger data-testid={`transaction-form-line-item-${idx}`}>
                              <SelectValue>
                                {(v) => {
                                  const sel = itemMap.get(v as string);
                                  return sel ? `${sel.kode} — ${sel.nama}` : "Pilih Barang";
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
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              type="number"
                              min={1}
                              value={line.jumlah}
                              onChange={(e) => setLine(idx, { jumlah: Number(e.target.value) || 0 })}
                              placeholder="Jumlah"
                              aria-label={`Jumlah barang ${idx + 1}`}
                              data-testid={`transaction-form-line-jumlah-${idx}`}
                            />
                            <Input
                              value={line.keterangan}
                              onChange={(e) => setLine(idx, { keterangan: e.target.value })}
                              placeholder="Keterangan baris (opsional)"
                              aria-label={`Keterangan barang ${idx + 1}`}
                              data-testid={`transaction-form-line-keterangan-${idx}`}
                            />
                          </div>
                          {it && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[11px]">
                                {it.kategori}
                              </Badge>
                              <span data-testid={`transaction-form-line-stok-${idx}`}>
                                Stok saat ini:{" "}
                                <span className={cn("font-bold", kurang && "text-rose-600")}>
                                  {it.stok} {it.satuan}
                                </span>
                              </span>
                              {kurang && <span className="font-semibold text-rose-600">Stok tidak mencukupi</span>}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mt-1.5 text-rose-600 hover:text-rose-700"
                          disabled={lines.length <= 1}
                          onClick={() => removeLine(idx)}
                          title="Hapus baris"
                          data-testid={`transaction-form-remove-line-${idx}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground" data-testid="transaction-form-lines-summary">
                  {filledLines.length} jenis barang · total{" "}
                  {filledLines.reduce((a, l) => a + l.jumlah, 0)} unit — semua baris memakai satu nomor transaksi.
                </p>
              </div>
            )}

            <div className={multi ? "hidden" : undefined}>
              <Label>Nama Barang *</Label>
              <Select
                value={form.item_id}
                onValueChange={(v: string) => {
                  const it = itemMap.get(v);
                  setForm((f) => ({
                    ...f,
                    item_id: v,
                    harga_satuan: isMasuk && it ? (it.harga_satuan || f.harga_satuan) : f.harga_satuan,
                    lokasi: f.lokasi || it?.lokasi || "",
                    kondisi: it?.kondisi || f.kondisi,
                  }));
                }}
                disabled={Boolean(editing)}
              >
                <SelectTrigger data-testid="transaction-form-select-item">
                  <SelectValue>
                    {(v) => {
                      const it = itemMap.get(v as string);
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
              {selectedItem && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[11px]">
                    {selectedItem.kategori}
                  </Badge>
                  <span>
                    Stok saat ini:{" "}
                    <span className={cn("font-bold", !isMasuk && selectedItem.stok <= selectedItem.stok_minimum && "text-rose-600")}>
                      {selectedItem.stok} {selectedItem.satuan}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {isMasuk && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tx-harga">Harga Satuan (Rp)</Label>
                    <Input
                      id="tx-harga"
                      type="number"
                      min={0}
                      value={form.harga_satuan}
                      onChange={(e) => setForm((f) => ({ ...f, harga_satuan: Number(e.target.value) || 0 }))}
                      data-testid="transaction-form-input-harga"
                    />
                  </div>
                  <div>
                    <Label>Total Harga (otomatis)</Label>
                    <div className="rounded-md border bg-emerald-50 px-3 py-2.5 text-sm font-bold tabular-nums text-emerald-800" data-testid="transaction-form-total">
                      {fmtRp(totalHarga)}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Sumber Dana</Label>
                    <Select value={form.sumber_dana} onValueChange={(v: string) => setForm((f) => ({ ...f, sumber_dana: v }))}>
                      <SelectTrigger data-testid="transaction-form-select-sumber">
                        <SelectValue>{(v) => v || "Lainnya"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SUMBER_DANA.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lokasi Penyimpanan</Label>
                    <Input
                      value={form.lokasi}
                      onChange={(e) => setForm((f) => ({ ...f, lokasi: e.target.value }))}
                      placeholder="cth. Gudang Utama"
                      data-testid="transaction-form-input-lokasi"
                    />
                  </div>
                  <div>
                    <Label>Kondisi</Label>
                    <Select value={form.kondisi} onValueChange={(v: string) => setForm((f) => ({ ...f, kondisi: v }))}>
                      <SelectTrigger data-testid="transaction-form-select-kondisi">
                        <SelectValue>{(v) => v || "Baik"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {KONDISI.map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {!isMasuk && (
              <div>
                <Label htmlFor="tx-penerima">Nama Penerima / Unit *</Label>
                <Input
                  id="tx-penerima"
                  value={form.penerima}
                  onChange={(e) => setForm((f) => ({ ...f, penerima: e.target.value }))}
                  placeholder="cth. Guru Kelas 3 / Perpustakaan"
                  data-testid="transaction-form-input-penerima"
                />
              </div>
            )}

            <div>
              <Label htmlFor="tx-keterangan">{isMasuk ? "Keterangan / No. Faktur" : "Keperluan / Keterangan"}</Label>
              <Textarea
                id="tx-keterangan"
                rows={2}
                value={form.keterangan}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
                data-testid="transaction-form-input-keterangan"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} data-testid="transaction-form-cancel-button">
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={save.isPending || (multi ? !multiValid : !form.item_id || form.jumlah < 1)}
              data-testid="transaction-form-save-button"
            >
              {save.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="transaction-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-mono">{detail?.nomor}</DialogTitle>
            <DialogDescription>
              {detail?.jenis === "masuk" ? "Transaksi Barang Masuk" : "Transaksi Barang Keluar"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {[
                ["Tanggal", fmtTanggal(detail.tanggal)],
                ["Nama Barang", detail.nama_barang],
                ["Kode Barang", detail.kode_barang],
                ["Kategori", detail.kategori],
                ["Jumlah", `${detail.jumlah} ${detail.satuan}`],
                ...(detail.jenis === "masuk"
                  ? ([
                      ["Harga Satuan", fmtRp(detail.harga_satuan)],
                      ["Total Harga", fmtRp(detail.total_harga)],
                      ["Sumber Dana", detail.sumber_dana || "-"],
                      ["Lokasi", detail.lokasi || "-"],
                      ["Kondisi", detail.kondisi || "-"],
                    ] as [string, string][])
                  : ([["Penerima", detail.penerima || "-"]] as [string, string][])),
                ["Keterangan", detail.keterangan || "-"],
                ["Dicatat Oleh", detail.user_name],
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
        title={`Hapus Transaksi ${deleting?.nomor ?? ""}?`}
        description={
          deleting
            ? `Transaksi ${deleting.nomor} (${deleting.nama_barang} x${deleting.jumlah} ${deleting.satuan}) akan dihapus dan stok barang akan dihitung ulang otomatis berdasarkan histori yang tersisa.`
            : ""
        }
        confirmLabel="Ya, Hapus"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
