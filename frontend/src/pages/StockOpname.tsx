import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardCheck, Download, Eye, Pencil, Plus, Printer, Scale, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut, downloadFile } from "@/lib/api";
import { errMsg, fmtTanggal, hariIni, toQS } from "@/lib/format";
import { useAuth, useSchoolProfile } from "@/lib/session";
import type { Item, Opname, OpnameDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { KopSurat, TandaTangan } from "@/components/kop-surat";

const KATEGORI = ["ATK", "Alat Kebersihan", "Meubelair", "Alat Elektronik", "Lainnya"];

function SelisihBadge({ v }: { v: number }) {
  if (v === 0) return <Badge className="bg-emerald-100 text-emerald-800">Sesuai</Badge>;
  if (v > 0) return <Badge className="bg-sky-100 text-sky-800">Lebih (+{v})</Badge>;
  return <Badge className="bg-rose-100 text-rose-800">Kurang ({v})</Badge>;
}

interface DraftRow {
  item: Item;
  checked: boolean;
  fisik: number;
  ket: string;
}

// Stok Opname: bandingkan stok sistem vs fisik; stok master hanya berubah lewat tombol "Sesuaikan Stok".
export default function StockOpname() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuth();
  const { data: profile } = useSchoolProfile();
  const qc = useQueryClient();

  const { data: opnames, isLoading } = useQuery({
    queryKey: ["opnames"],
    queryFn: () => apiGet<Opname[]>("/opnames"),
    retry: false,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Opname | null>(null);
  const [detailTarget, setDetailTarget] = useState<Opname | null>(null);
  const [deleting, setDeleting] = useState<Opname | null>(null);
  const [adjusting, setAdjusting] = useState<Opname | null>(null);
  const [printTarget, setPrintTarget] = useState<Opname | null>(null);

  // Form buat opname baru
  const [tanggal, setTanggal] = useState(hariIni());
  const [lokasiF, setLokasiF] = useState("");
  const [kategoriF, setKategoriF] = useState("");
  const [petugas, setPetugas] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  // Form edit (draft saja)
  const [editTanggal, setEditTanggal] = useState("");
  const [editPetugas, setEditPetugas] = useState("");
  const [editRows, setEditRows] = useState<OpnameDetail[]>([]);

  const { data: items } = useQuery({
    queryKey: ["items", { lokasi: lokasiF, kategori: kategoriF }, "opname-ref"],
    queryFn: () => apiGet<Item[]>(`/items?${toQS({ lokasi: lokasiF, kategori: kategoriF })}`),
    enabled: createOpen,
    retry: false,
  });

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setTanggal(hariIni());
      setLokasiF("");
      setKategoriF("");
      setPetugas(user?.nama ?? "");
      setDrafts([]);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user?.nama]);

  // Saat daftar barang berubah, isi baris draft (stok fisik default = stok sistem).
  useEffect(() => {
    if (createOpen) {
      setDrafts((prev) => {
        const map = new Map(prev.map((d) => [d.item.id, d]));
        return (items ?? []).map((it) => map.get(it.id) ?? { item: it, checked: false, fisik: it.stok, ket: "" });
      });
    }
  }, [items, createOpen]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["opnames"] });
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["kartu-stok"] });
  };

  const create = useMutation({
    mutationFn: () =>
      apiPost<Opname>("/opnames", {
        tanggal,
        lokasi: lokasiF,
        kategori: kategoriF,
        petugas,
        items: drafts
          .filter((d) => d.checked)
          .map((d) => ({ item_id: d.item.id, stok_fisik: d.fisik, keterangan: d.ket })),
      }),
    onSuccess: (o) => {
      toast.success(`Stok opname ${o.nomor} berhasil dibuat. Stok master belum berubah.`);
      invalidate();
      setCreateOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const update = useMutation({
    mutationFn: () =>
      apiPut<Opname>(`/opnames/${editTarget!.id}`, {
        tanggal: editTanggal,
        lokasi: editTarget!.lokasi,
        kategori: editTarget!.kategori,
        petugas: editPetugas,
        details: editRows,
      }),
    onSuccess: () => {
      toast.success("Stok opname diperbarui");
      invalidate();
      setEditTarget(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const adjust = useMutation({
    mutationFn: (id: string) => apiPost<{ message: string; disesuaikan: number }>(`/opnames/${id}/adjust`),
    onSuccess: (r) => {
      toast.success(r.message);
      setAdjusting(null);
      setDetailTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ message: string }>(`/opnames/${id}`),
    onSuccess: (r) => {
      toast.success(r.message);
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const submitCreate = () => {
    if (drafts.filter((d) => d.checked).length === 0) {
      toast.error("Pilih minimal satu barang untuk diopname");
      return;
    }
    create.mutate();
  };

  const list = opnames ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Stok Opname</h1>
          <p className="text-sm text-muted-foreground">
            Bandingkan stok sistem dengan jumlah fisik. Selisih = Stok Fisik − Stok Sistem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadFile("/export/opname")} data-testid="opname-export-button">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button
            onClick={() => {
              setTanggal(hariIni());
              setLokasiF("");
              setKategoriF("");
              setPetugas(user?.nama ?? "");
              setDrafts([]);
              setCreateOpen(true);
            }}
            data-testid="opname-create-button"
          >
            <Plus className="h-4 w-4" /> Buat Stok Opname
          </Button>
        </div>
      </div>

      {/* Daftar opname */}
      <div className="overflow-x-auto rounded-xl border bg-card" data-testid="opname-table">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>No. Opname</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Barang Diperiksa</TableHead>
              <TableHead>Hasil</TableHead>
              <TableHead>Petugas</TableHead>
              <TableHead>Status</TableHead>
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
              list.map((o, idx) => {
                const nonzero = o.details.filter((d) => d.selisih !== 0).length;
                return (
                  <TableRow key={o.id} className={cn(idx % 2 === 1 && "bg-slate-50/50")} data-testid={`opname-row-${o.nomor}`}>
                    <TableCell className="font-mono text-xs font-semibold">{o.nomor}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtTanggal(o.tanggal)}</TableCell>
                    <TableCell className="text-sm">{o.lokasi || "Semua"}</TableCell>
                    <TableCell className="text-sm">{o.kategori || "Semua"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{o.details.length}</TableCell>
                    <TableCell>
                      {nonzero === 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Sesuai</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800">{nonzero} barang selisih</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">{o.petugas}</TableCell>
                    <TableCell>
                      {o.status === "disesuaikan" ? (
                        <Badge className="bg-sky-100 text-sky-800">Disesuaikan</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setDetailTarget(o)} title="Detail" data-testid={`opname-detail-button-${o.nomor}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {o.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setEditTarget(o);
                              setEditTanggal(o.tanggal);
                              setEditPetugas(o.petugas);
                              setEditRows(o.details.map((d) => ({ ...d })));
                            }}
                            title="Edit"
                            data-testid={`opname-edit-button-${o.nomor}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-xs" onClick={() => setPrintTarget(o)} title="Cetak" data-testid={`opname-cetak-button-${o.nomor}`}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(o)} title="Hapus" className="text-rose-600 hover:text-rose-700" data-testid={`opname-delete-button-${o.nomor}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground" data-testid="opname-empty">
                  <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  Belum ada stok opname. Klik “Buat Stok Opname” untuk memulai pemeriksaan fisik.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog buat opname */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="opname-create-dialog">
          <DialogHeader>
            <DialogTitle>Buat Stok Opname</DialogTitle>
            <DialogDescription>
              Stok sistem diambil otomatis saat opname disimpan. Stok master TIDAK langsung berubah — gunakan tombol
              “Sesuaikan Stok” setelah memeriksa hasil.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="opname-tanggal">Tanggal</Label>
              <Input id="opname-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} data-testid="opname-input-tanggal" />
            </div>
            <div>
              <Label htmlFor="opname-lokasi">Filter Lokasi</Label>
              <Input
                id="opname-lokasi"
                value={lokasiF}
                onChange={(e) => setLokasiF(e.target.value)}
                placeholder="Semua lokasi"
                data-testid="opname-filter-lokasi"
              />
            </div>
            <div>
              <Label>Filter Kategori</Label>
              <Select value={kategoriF} onValueChange={(v: string) => setKategoriF(v)}>
                <SelectTrigger data-testid="opname-filter-kategori">
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
            <div>
              <Label htmlFor="opname-petugas">Petugas</Label>
              <Input id="opname-petugas" value={petugas} onChange={(e) => setPetugas(e.target.value)} data-testid="opname-input-petugas" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border" data-testid="opname-items-list">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10">Pilih</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead className="text-right">Stok Sistem</TableHead>
                  <TableHead className="w-28">Stok Fisik</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((d, idx) => (
                  <TableRow key={d.item.id} data-testid={`opname-item-row-${idx}`}>
                    <TableCell>
                      <Checkbox
                        checked={d.checked}
                        onCheckedChange={(v: boolean) => setDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, checked: Boolean(v) } : r)))}
                        data-testid={`opname-check-${idx}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.item.kode}</TableCell>
                    <TableCell className="max-w-56 truncate text-sm">{d.item.nama}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {d.item.stok} {d.item.satuan}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={d.fisik}
                        onChange={(e) => setDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, fisik: Number(e.target.value) || 0 } : r)))}
                        data-testid={`opname-fisik-input-${idx}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={d.ket}
                        onChange={(e) => setDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, ket: e.target.value } : r)))}
                        placeholder="Penyebab selisih (opsional)"
                        data-testid={`opname-ket-input-${idx}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {drafts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada barang pada filter lokasi/kategori ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="opname-cancel-button">
              Batal
            </Button>
            <Button onClick={submitCreate} disabled={create.isPending} data-testid="opname-submit-button">
              {create.isPending ? "Menyimpan…" : "Simpan Opname"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detail */}
      <Dialog open={Boolean(detailTarget)} onOpenChange={(v) => !v && setDetailTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="opname-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-mono">{detailTarget?.nomor}</DialogTitle>
            <DialogDescription>
              Hasil stok opname {detailTarget && fmtTanggal(detailTarget.tanggal)} — stok master belum berubah selama
              status masih draft.
            </DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="text-right">Stok Sistem</TableHead>
                      <TableHead className="text-right">Stok Fisik</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailTarget.details.map((d) => (
                      <TableRow key={d.item_id} data-testid={`opname-detail-row-${d.kode}`}>
                        <TableCell className="font-mono text-xs">{d.kode}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{d.nama}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{d.stok_sistem}</TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{d.stok_fisik}</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">{d.selisih > 0 ? `+${d.selisih}` : d.selisih}</TableCell>
                        <TableCell>
                          <SelisihBadge v={d.selisih} />
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-xs text-slate-600">{d.keterangan || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Petugas: {detailTarget.petugas} · Status: {detailTarget.status === "draft" ? "Draft (belum disesuaikan)" : "Disesuaikan"}
                </span>
                {detailTarget.status === "draft" && detailTarget.details.some((d) => d.selisih !== 0) && (
                  <Button onClick={() => setAdjusting(detailTarget)} data-testid="opname-adjust-button">
                    <Scale className="h-4 w-4" /> Sesuaikan Stok
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog edit (draft saja) */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="opname-edit-dialog">
          <DialogHeader>
            <DialogTitle>Edit Stok Opname {editTarget?.nomor}</DialogTitle>
            <DialogDescription>Perbarui stok fisik hasil pemeriksaan. Selisih dihitung ulang otomatis.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="opname-edit-tanggal">Tanggal</Label>
              <Input id="opname-edit-tanggal" type="date" value={editTanggal} onChange={(e) => setEditTanggal(e.target.value)} data-testid="opname-edit-tanggal" />
            </div>
            <div>
              <Label htmlFor="opname-edit-petugas">Petugas</Label>
              <Input id="opname-edit-petugas" value={editPetugas} onChange={(e) => setEditPetugas(e.target.value)} data-testid="opname-edit-petugas" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead className="text-right">Stok Sistem</TableHead>
                  <TableHead className="w-28">Stok Fisik</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editRows.map((d, idx) => (
                  <TableRow key={d.item_id}>
                    <TableCell className="font-mono text-xs">{d.kode}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{d.nama}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{d.stok_sistem}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={d.stok_fisik}
                        onChange={(e) => setEditRows((prev) => prev.map((r, i) => (i === idx ? { ...r, stok_fisik: Number(e.target.value) || 0 } : r)))}
                        data-testid={`opname-edit-fisik-${idx}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={d.keterangan}
                        onChange={(e) => setEditRows((prev) => prev.map((r, i) => (i === idx ? { ...r, keterangan: e.target.value } : r)))}
                        data-testid={`opname-edit-ket-${idx}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} data-testid="opname-edit-cancel-button">
              Batal
            </Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending} data-testid="opname-edit-save-button">
              {update.isPending ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi sesuaikan stok */}
      <ConfirmDialog
        open={Boolean(adjusting)}
        onOpenChange={(v) => !v && setAdjusting(null)}
        title="Sesuaikan Stok Master?"
        description={
          adjusting
            ? `Sistem akan mencatat transaksi penyesuaian (BM/BK) untuk setiap barang berselisih dan stok master akan diubah sesuai hasil opname ${adjusting.nomor}. Tindakan ini tidak dapat dibatalkan. Lanjutkan?`
            : ""
        }
        confirmLabel="Ya, Sesuaikan Stok"
        destructive={false}
        loading={adjust.isPending}
        onConfirm={() => adjusting && adjust.mutate(adjusting.id)}
      />

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Hapus ${deleting?.nomor ?? "Opname"}?`}
        description="Data stok opname akan dihapus. Transaksi penyesuaian yang sudah tercipta tetap berlaku agar histori stok konsisten."
        confirmLabel="Ya, Hapus"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />

      {/* Dialog cetak berita acara */}
      <Dialog open={Boolean(printTarget)} onOpenChange={(v) => !v && setPrintTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="opname-print-dialog">
          <DialogHeader>
            <DialogTitle>Pratinjau Cetak</DialogTitle>
            <DialogDescription>Tekan tombol Cetak untuk membuka dialog cetak / simpan sebagai PDF.</DialogDescription>
          </DialogHeader>
          {printTarget && profile && (
            <div className="print-area rounded-lg border bg-white p-4 text-slate-900" data-testid="opname-print-area">
              <KopSurat
                profile={profile}
                title="BERITA ACARA HASIL STOK OPNAME"
                subtitle={`Nomor: ${printTarget.nomor} · Tanggal: ${fmtTanggal(printTarget.tanggal)}`}
              />
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-700">
                <span>
                  Lokasi: <span className="font-semibold">{printTarget.lokasi || "Semua"}</span>
                </span>
                <span>
                  Kategori: <span className="font-semibold">{printTarget.kategori || "Semua"}</span>
                </span>
                <span>
                  Petugas: <span className="font-semibold">{printTarget.petugas}</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="text-right">Sistem</TableHead>
                      <TableHead className="text-right">Fisik</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printTarget.details.map((d) => (
                      <TableRow key={d.item_id}>
                        <TableCell className="font-mono text-xs">{d.kode}</TableCell>
                        <TableCell className="text-sm">{d.nama}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{d.stok_sistem}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{d.stok_fisik}</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">{d.selisih > 0 ? `+${d.selisih}` : d.selisih}</TableCell>
                        <TableCell className="text-xs">
                          {d.selisih === 0 ? "Sesuai" : d.selisih > 0 ? "Lebih" : "Kurang"}
                        </TableCell>
                        <TableCell className="text-xs">{d.keterangan || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TandaTangan profile={profile} tanggal={fmtTanggal(hariIni())} />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => window.print()} data-testid="opname-print-confirm-button">
              <Printer className="h-4 w-4" /> Cetak / Simpan PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
