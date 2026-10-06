// Helper format & konversi kecil yang dipakai lintas halaman (locale id-ID).

export function fmtTanggal(iso: string): string {
  if (!iso) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return iso;
}

export function fmtWaktu(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
}

export function fmtAngka(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

// Tanggal hari ini (lokal browser) sebagai YYYY-MM-DD untuk nilai awal form.
export function hariIni(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toQS(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

export function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "body" in err) {
    const b = (err as { body: unknown }).body;
    if (typeof b === "string") return b;
    if (b && typeof b === "object" && "detail" in b) {
      const d = (b as { detail: unknown }).detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
        return String((d[0] as { msg: unknown }).msg);
      }
    }
  }
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export type StokStatus = "aman" | "menipis" | "habis";

export function statusStok(stok: number, minimum: number): StokStatus {
  if (stok <= 0) return "habis";
  if (stok <= minimum) return "menipis";
  return "aman";
}

export function labelJenis(jenis: string): string {
  return jenis === "inventaris" ? "Inventaris/Aset" : "Persediaan";
}

export function labelRole(role: string): string {
  return role === "admin" ? "Administrator" : "Pengurus Barang";
}

export function labelAksi(aksi: string): string {
  const map: Record<string, string> = {
    Login: "Masuk",
    Logout: "Keluar",
    "Tambah Barang": "Tambah",
    "Edit Barang": "Edit",
    "Hapus Barang": "Hapus",
    "Arsip Barang": "Arsip",
  };
  return map[aksi] ?? aksi;
}
