import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiGet, apiPost, downloadFile } from "@/lib/api";
import { fmtAngka, fmtTanggal, toQS } from "@/lib/format";
import { useSchoolProfile } from "@/lib/session";
import type { Item, KartuStok } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KopSurat, TandaTangan } from "@/components/kop-surat";

const PERIODES = [
  { value: "bulan-ini", label: "Bulan Ini" },
  { value: "3-bulan", label: "3 Bulan Terakhir" },
  { value: "tahun-ini", label: "Tahun Ini" },
  { value: "semua", label: "Semua Periode" },
  { value: "custom", label: "Kustom" },
];

function rangeFor(p: string): { awal: string; akhir: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (p === "bulan-ini") return { awal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, akhir: today };
  if (p === "tahun-ini") return { awal: `${now.getFullYear()}-01-01`, akhir: today };
  if (p === "3-bulan") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return { awal: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, akhir: today };
  }
  return { awal: "", akhir: "" };
}

// Kartu Stok: riwayat running balance per barang (Saldo Awal → Masuk/Keluar → Saldo).
export default function StockCard() {
  const [searchParams] = useSearchParams();
  const [itemId, setItemId] = useState(() => searchParams.get("item_id") ?? "");
  const [periode, setPeriode] = useState("semua");
  const [customAwal, setCustomAwal] = useState("");
  const [customAkhir, setCustomAkhir] = useState("");
  const { data: profile } = useSchoolProfile();
  const { data: items } = useQuery({
    queryKey: ["items", "ref"],
    queryFn: () => apiGet<Item[]>("/items"),
    staleTime: 60_000,
    retry: false,
  });

  const range = periode === "custom" ? { awal: customAwal, akhir: customAkhir } : rangeFor(periode);
  const { data, isLoading } = useQuery({
    queryKey: ["kartu-stok", itemId, range.awal, range.akhir],
    queryFn: () => apiGet<KartuStok>(`/items/${itemId}/kartu-stok?${toQS({ awal: range.awal, akhir: range.akhir })}`),
    enabled: Boolean(itemId),
    retry: false,
  });

  const print = async () => {
    try {
      await apiPost("/audit", { aksi: "Cetak", detail: `Kartu Stok ${data?.item.kode ?? ""}` });
    } catch {
      /* pencatatan audit gagal tidak boleh menghalangi cetak */
    }
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Kartu Stok</h1>
          <p className="text-sm text-muted-foreground">Riwayat mutasi barang: Saldo Awal + Masuk − Keluar = Saldo Akhir</p>
        </div>
      </div>

      {/* Pilih barang & periode */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-end" data-testid="kartu-stok-controls">
        <div className="flex-1">
          <Label>Pilih Barang</Label>
          <Select value={itemId} onValueChange={(v: string) => setItemId(v)}>
            <SelectTrigger data-testid="kartu-stok-select-item">
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
        <div className="md:w-44">
          <Label>Periode</Label>
          <Select value={periode} onValueChange={(v: string) => setPeriode(v)}>
            <SelectTrigger data-testid="kartu-stok-select-periode">
              <SelectValue>{(v) => PERIODES.find((p) => p.value === v)?.label ?? "Semua Periode"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIODES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {periode === "custom" && (
          <>
            <div>
              <Label>Dari</Label>
              <Input type="date" value={customAwal} onChange={(e) => setCustomAwal(e.target.value)} data-testid="kartu-stok-awal" />
            </div>
            <div>
              <Label>Sampai</Label>
              <Input type="date" value={customAkhir} onChange={(e) => setCustomAkhir(e.target.value)} data-testid="kartu-stok-akhir" />
            </div>
          </>
        )}
        {itemId && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} data-testid="kartu-stok-print-button">
              Cetak
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadFile("/export/kartu-stok", { item_id: itemId, awal: range.awal, akhir: range.akhir })}
              data-testid="kartu-stok-export-button"
            >
              Export Excel
            </Button>
          </div>
        )}
      </div>

      {!itemId && (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground" data-testid="kartu-stok-empty">
          Pilih barang terlebih dahulu untuk melihat kartu stok.
        </div>
      )}

      {itemId && data && (
        <div className="print-area rounded-xl border bg-white p-4 md:p-6" data-testid="kartu-stok-report">
          {profile && <KopSurat profile={profile} title="KARTU STOK BARANG" subtitle={`Periode: ${range.awal ? fmtTanggal(range.awal) : "Awal"} s.d. ${range.akhir ? fmtTanggal(range.akhir) : "Sekarang"}`} />}
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>
              Kode: <span className="font-mono font-semibold text-slate-900">{data.item.kode}</span>
            </span>
            <span>
              Nama: <span className="font-semibold text-slate-900">{data.item.nama}</span>
            </span>
            <span>
              Kategori: <span className="font-semibold text-slate-900">{data.item.kategori}</span>
            </span>
            <span>
              Satuan: <span className="font-semibold text-slate-900">{data.item.satuan}</span>
            </span>
            <span>
              Lokasi: <span className="font-semibold text-slate-900">{data.item.lokasi || "-"}</span>
            </span>
          </div>

          {/* Ringkasan periode */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="kartu-stok-summary">
            {[
              { label: "Stok Awal Periode", value: data.saldo_awal },
              { label: "Total Masuk", value: data.total_masuk },
              { label: "Total Keluar", value: data.total_keluar },
              { label: "Penyesuaian", value: data.total_penyesuaian },
              { label: "Stok Akhir", value: data.saldo_akhir },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-slate-50 p-2.5">
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
                <div className="font-heading text-lg font-bold tabular-nums text-slate-900">
                  {fmtAngka(s.value)} <span className="text-xs font-normal text-muted-foreground">{data.item.satuan}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Transaksi</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Keluar</TableHead>
                  <TableHead className="text-right">Penyesuaian</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-emerald-50/60">
                  <TableCell className="text-sm">—</TableCell>
                  <TableCell className="text-sm">—</TableCell>
                  <TableCell className="text-sm font-semibold">SALDO AWAL</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm font-bold tabular-nums">{fmtAngka(data.saldo_awal)}</TableCell>
                </TableRow>
                {data.rows.map((r, i) => (
                  <TableRow key={`${r.nomor}-${i}`} data-testid={`kartu-stok-row-${i}`}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtTanggal(r.tanggal)}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{r.nomor}</TableCell>
                    <TableCell className="max-w-72 truncate text-sm">{r.keterangan}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-emerald-700">{r.masuk ? fmtAngka(r.masuk) : "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-700">{r.keluar ? fmtAngka(r.keluar) : "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-sky-700">
                      {r.penyesuaian ? (r.penyesuaian > 0 ? `+${fmtAngka(r.penyesuaian)}` : fmtAngka(r.penyesuaian)) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold tabular-nums">{fmtAngka(r.saldo)}</TableCell>
                  </TableRow>
                ))}
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada mutasi pada periode ini.
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-slate-100">
                  <TableCell colSpan={3} className="text-sm font-bold">
                    STOK AKHIR
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{fmtAngka(data.total_masuk)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{fmtAngka(data.total_keluar)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{fmtAngka(data.total_penyesuaian)}</TableCell>
                  <TableCell className="text-right font-heading text-base font-bold tabular-nums text-emerald-800">
                    {fmtAngka(data.saldo_akhir)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {profile && <TandaTangan profile={profile} tanggal={fmtTanggal(new Date().toISOString().slice(0, 10))} />}
        </div>
      )}

      {itemId && isLoading && (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Memuat kartu stok…</div>
      )}
    </div>
  );
}
