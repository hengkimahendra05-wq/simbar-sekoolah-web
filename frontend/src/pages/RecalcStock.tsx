import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Calculator, RefreshCw, TriangleAlert } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtAngka } from "@/lib/format";
import type { RecalcReport } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDialog from "@/components/confirm-dialog";

// Hitung Ulang Stok (§AA) — khusus Administrator. Membandingkan stok tersimpan dengan
// hasil perhitungan dari histori transaksi; sinkronisasi hanya setelah konfirmasi.
export default function RecalcStock() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["stock-recalc-check"],
    queryFn: () => apiGet<RecalcReport>("/stock/recalc-check"),
    retry: false,
  });

  const apply = useMutation({
    mutationFn: () => apiPost<RecalcReport>("/stock/recalc-apply"),
    onSuccess: (r) => {
      toast.success(
        r.tidak_sesuai === 0
          ? "Semua stok sudah sesuai — tidak ada yang perlu disinkronkan"
          : `${r.tidak_sesuai} barang berhasil disinkronkan dengan hasil perhitungan`,
      );
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["stock-recalc-check"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = data?.rows ?? [];
  const konsisten = data && data.tidak_sesuai === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Hitung Ulang Stok</h1>
          <p className="text-sm text-muted-foreground">
            Memeriksa konsistensi stok tersimpan terhadap histori transaksi (Stok Awal + Masuk − Keluar + Penyesuaian).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="recalc-refresh-button">
            <RefreshCw className="h-4 w-4" /> {isFetching ? "Memeriksa…" : "Periksa Ulang"}
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!data || konsisten} data-testid="recalc-apply-button">
            <Calculator className="h-4 w-4" /> Sinkronkan Stok
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="recalc-summary">
        {[
          { label: "Barang Diperiksa", value: data?.total_barang ?? 0 },
          { label: "Stok Tidak Sesuai", value: data?.tidak_sesuai ?? 0 },
          { label: "Stok Konsisten", value: (data?.total_barang ?? 0) - (data?.tidak_sesuai ?? 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="font-heading text-2xl font-bold tabular-nums text-slate-900">{fmtAngka(s.value)}</div>
          </div>
        ))}
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" data-testid="recalc-error">
          Gagal memuat pemeriksaan stok. Fitur ini hanya dapat diakses oleh Administrator.
        </div>
      )}

      {konsisten && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4" data-testid="recalc-consistent">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900">
            <b>Seluruh stok konsisten.</b> Angka stok pada Dashboard, Data Barang, Kartu Stok, Laporan, dan Stok Opname
            sudah sama dengan hasil perhitungan dari histori transaksi. Tidak ada yang perlu disinkronkan.
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perbandingan Stok</CardTitle>
          <CardDescription>
            Hanya barang dengan selisih yang ditampilkan. Sinkronisasi tidak dijalankan otomatis tanpa konfirmasi
            Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Stok Awal</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Keluar</TableHead>
                  <TableHead className="text-right">Penyesuaian</TableHead>
                  <TableHead className="text-right">Stok Sistem</TableHead>
                  <TableHead className="text-right">Hasil Perhitungan</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      Memeriksa seluruh barang…
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.item_id} className="bg-amber-50/60" data-testid={`recalc-row-${r.kode}`}>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="max-w-56 truncate text-sm font-medium">{r.nama}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmtAngka(r.stok_awal)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-emerald-700">{fmtAngka(r.total_masuk)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-700">{fmtAngka(r.total_keluar)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-sky-700">{fmtAngka(r.penyesuaian)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmtAngka(r.stok_tersimpan)}</TableCell>
                    <TableCell className="text-right text-sm font-bold tabular-nums">{fmtAngka(r.stok_hitung)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={r.selisih > 0 ? "bg-sky-100 text-sky-800" : "bg-rose-100 text-rose-800"}>
                        {r.selisih > 0 ? `+${r.selisih}` : r.selisih}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground" data-testid="recalc-empty">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                      Tidak ada perbedaan stok. Semua data konsisten.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Stok pada aplikasi ini selalu dihitung ulang otomatis setiap kali transaksi ditambah, diedit, atau dihapus —
          sehingga selisih semestinya tidak pernah muncul. Fitur ini disediakan sebagai pemeriksaan integritas data.
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sinkronkan Stok Sekarang?"
        description={`Stok tersimpan untuk ${data?.tidak_sesuai ?? 0} barang akan ditimpa dengan hasil perhitungan dari histori transaksi. Lanjutkan?`}
        confirmLabel="Ya, Sinkronkan"
        destructive={false}
        loading={apply.isPending}
        onConfirm={() => apply.mutate()}
      />
    </div>
  );
}
