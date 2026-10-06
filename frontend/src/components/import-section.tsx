import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, FileUp, Upload, XCircle, AlertTriangle, CircleHelp } from "lucide-react";
import { apiPost, apiPostForm, downloadFile } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { ImportPreview, ImportResult, ImportRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MODES: { value: "tambah" | "update" | "lewati"; label: string; desc: string }[] = [
  { value: "tambah", label: "Tambahkan sebagai data baru", desc: "Data duplikat tetap ditambahkan dengan kode barang baru." },
  { value: "update", label: "Perbarui data yang sudah ada", desc: "Data barang yang cocok akan diperbarui sesuai file." },
  { value: "lewati", label: "Lewati data duplikat", desc: "Data duplikat dilewati, hanya data baru yang diimport." },
];

function statusBadge(row: ImportRow) {
  if (row.status === "valid")
    return (
      <Badge className="bg-emerald-100 text-emerald-800" data-testid="import-status-valid">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
      </Badge>
    );
  if (row.status === "duplikat")
    return (
      <Badge className="bg-amber-100 text-amber-800" data-testid="import-status-duplikat">
        <AlertTriangle className="mr-1 h-3 w-3" /> Duplikat
      </Badge>
    );
  return (
    <Badge className="bg-rose-100 text-rose-800" data-testid="import-status-error">
      <XCircle className="mr-1 h-3 w-3" /> Error
    </Badge>
  );
}

// Alur import Excel lengkap: template → unggah → pratinjau tervalidasi → mode duplikat → import.
export default function ImportSection() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<"tambah" | "update" | "lewati">("lewati");
  const [fileName, setFileName] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiPostForm<ImportPreview>("/import/preview", fd);
    },
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const commit = useMutation({
    mutationFn: () => apiPost<ImportResult>("/import/commit", { mode, rows: preview?.rows ?? [] }),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        `Import selesai: ${data.berhasil} berhasil, ${data.diperbarui} diperbarui, ${data.dilewati} dilewati, ${data.gagal} gagal`,
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setFileName(f.name);
    upload.mutate(f);
  };

  const processable = preview ? preview.valid + preview.duplikat : 0;

  return (
    <div className="space-y-4" data-testid="import-section">
      {/* Langkah 1: template */}
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-sm font-semibold text-emerald-900">Langkah 1 — Unduh Template Excel</div>
          <div className="text-xs text-emerald-800/80">
            Template sudah sesuai format kolom master data barang. Isi datanya, lalu unggah kembali.
          </div>
        </div>
        <Button variant="outline" onClick={() => downloadFile("/export/template-import")} data-testid="import-template-button">
          <Download className="h-4 w-4" /> Unduh Template (.xlsx)
        </Button>
      </div>

      {/* Langkah 2: unggah */}
      <div>
        <div className="mb-1.5 text-sm font-semibold text-slate-900">Langkah 2 — Unggah File</div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40",
          )}
          data-testid="import-upload-zone"
        >
          <FileUp className="h-8 w-8 text-emerald-600" />
          <div className="text-sm font-medium text-slate-700">
            {upload.isPending ? "Membaca file…" : "Klik atau seret file ke sini"}
          </div>
          <div className="text-xs text-muted-foreground">Format: .xlsx, .xls, atau .csv (maks 5 MB)</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            data-testid="import-file-input"
          />
        </div>
        {fileName && !upload.isPending && <div className="mt-1 text-xs text-muted-foreground">File: {fileName}</div>}
      </div>

      {/* Langkah 3: pratinjau tervalidasi */}
      {preview && (
        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-900">
            Langkah 3 — Pratinjau &amp; Validasi ({preview.total} baris)
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800">{preview.valid} Valid</Badge>
            <Badge className="bg-amber-100 text-amber-800">{preview.duplikat} Duplikat</Badge>
            <Badge className="bg-rose-100 text-rose-800">{preview.error} Error</Badge>
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead>Baris</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Keterangan Validasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow
                    key={r.baris}
                    className={cn(r.status === "error" && "bg-rose-50", r.status === "duplikat" && "bg-amber-50")}
                    data-testid={`import-preview-row-${r.baris}`}
                  >
                    <TableCell className="font-mono text-xs">{r.baris}</TableCell>
                    <TableCell className="font-mono text-xs">{r.kode || "-"}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{r.nama || "-"}</TableCell>
                    <TableCell className="text-sm">{r.kategori || "-"}</TableCell>
                    <TableCell className="text-sm">{r.stok}</TableCell>
                    <TableCell>{statusBadge(r)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{r.pesan || (r.status === "valid" ? "Siap diimport" : "-")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Langkah 4: mode duplikat + tombol import */}
      {preview && (
        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-900">Langkah 4 — Penanganan Data Duplikat</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((md) => (
              <button
                key={md.value}
                type="button"
                onClick={() => setMode(md.value)}
                data-testid={`import-mode-${md.value}`}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  mode === md.value ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "hover:border-emerald-400",
                )}
              >
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {mode === md.value ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <CircleHelp className="h-4 w-4 text-slate-400" />
                  )}
                  {md.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{md.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => commit.mutate()} disabled={commit.isPending || processable === 0} data-testid="import-commit-button">
              <Upload className="h-4 w-4" />
              {commit.isPending ? "Mengimpor…" : `Import ${processable} Data`}
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)} data-testid="import-reset-button">
              Batal
            </Button>
            {processable === 0 && (
              <span className="text-xs text-rose-600">Tidak ada data yang dapat diimport (semua error).</span>
            )}
          </div>
        </div>
      )}

      {/* Hasil */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4" data-testid="import-result">
          <div className="text-sm font-semibold text-emerald-900">Import Selesai</div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              Berhasil: <span className="font-bold text-emerald-700">{result.berhasil}</span>
            </div>
            <div>
              Diperbarui: <span className="font-bold text-sky-700">{result.diperbarui}</span>
            </div>
            <div>
              Dilewati: <span className="font-bold text-amber-700">{result.dilewati}</span>
            </div>
            <div>
              Gagal: <span className="font-bold text-rose-700">{result.gagal}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
