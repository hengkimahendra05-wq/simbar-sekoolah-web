import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, History } from "lucide-react";
import { apiGet, downloadFile } from "@/lib/api";
import { fmtWaktu, labelRole, toQS } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PER_PAGE = 20;

// Riwayat Aktivitas (audit trail) — khusus Administrator.
export default function AuditLog() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGet<AuditEntry[]>(`/audit?${toQS({ limit: 500 })}`),
    retry: false,
  });

  const filtered = (data ?? []).filter((l) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [l.user_name, l.aksi, l.entitas, l.detail].some((v) => (v ?? "").toLowerCase().includes(s));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Riwayat Aktivitas</h1>
          <p className="text-sm text-muted-foreground">Audit trail seluruh perubahan data oleh pengguna.</p>
        </div>
        <Button variant="outline" onClick={() => downloadFile("/export/audit")} data-testid="audit-export-button">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Cari pengguna / aksi / detail…"
        data-testid="audit-search-input"
      />

      <div className="overflow-x-auto rounded-xl border bg-card" data-testid="audit-table">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat data…
                </TableCell>
              </TableRow>
            )}
            {rows.map((l) => (
              <TableRow key={l.id} data-testid={`audit-row-${l.id}`}>
                <TableCell className="whitespace-nowrap text-xs">{fmtWaktu(l.waktu)}</TableCell>
                <TableCell className="text-sm font-medium">{l.user_name || "-"}</TableCell>
                <TableCell className="text-xs">{l.role ? labelRole(l.role) : "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px]">
                    {l.aksi}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{l.entitas || "-"}</TableCell>
                <TableCell className="max-w-96 truncate text-xs text-slate-600">{l.detail || "-"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground" data-testid="audit-empty">
                  <History className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  Belum ada aktivitas tercatat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} aktivitas</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} data-testid="audit-pagination-prev">
            Sebelumnya
          </Button>
          <span className="text-xs">
            Hal. {current}/{pages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} data-testid="audit-pagination-next">
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
