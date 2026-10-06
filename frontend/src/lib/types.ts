// Hand-written mirrors of the backend Pydantic models (backend/models/*.py) — nothing infers
// across the HTTP boundary, so keeping these in sync is manual discipline: change a model,
// change its interface here in the same edit.

export const KATEGORI = [
  "ATK",
  "Alat Kebersihan",
  "Meubelair",
  "Alat Elektronik",
  "Peralatan Bengkel",
  "Peralatan Laboratorium",
  "Peralatan Olahraga",
  "Lainnya",
] as const;
export const KONDISI = ["Baik", "Rusak Ringan", "Rusak Berat"] as const;
export const JENIS_OPTIONS = [
  { value: "persediaan", label: "Persediaan" },
  { value: "inventaris", label: "Inventaris/Aset" },
] as const;
export const SUMBER_DANA = ["BOS Reguler", "BOS Kinerja", "Komite", "Hibah", "Lainnya"];
export const SATUAN_OPTIONS = ["Buah", "Pcs", "Box", "Rim", "Pack", "Botol", "Roll", "Set", "Unit", "Lembar"];

export interface AuthUser {
  id: string;
  nama: string;
  username: string;
  email: string;
  role: "admin" | "pengurus";
  nip: string;
  foto: string;
  aktif: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  kode: string;
  nama: string;
  jenis: string; // persediaan | inventaris
  kategori: string;
  merk: string;
  tipe_model: string;
  spesifikasi: string;
  satuan: string;
  tahun: number | null;
  sumber_dana: string;
  lokasi: string;
  kondisi: string;
  status: string; // aktif | tidak_aktif | arsip
  nomor_seri: string;
  nup: string;
  stok_awal: number;
  stok_minimum: number;
  harga_satuan: number;
  keterangan: string;
  stok: number;
  archived: boolean;
  deleted_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface ItemInput {
  kode: string;
  nama: string;
  jenis: string;
  kategori: string;
  merk: string;
  tipe_model: string;
  spesifikasi: string;
  satuan: string;
  tahun: number | null;
  sumber_dana: string;
  lokasi: string;
  kondisi: string;
  status: string;
  nomor_seri: string;
  nup: string;
  stok_awal: number;
  stok_minimum: number;
  harga_satuan: number;
  keterangan: string;
}

export interface ItemPage {
  items: Item[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Category {
  id: string;
  kode: string;
  nama: string;
  keterangan: string;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  kode: string;
  nama: string;
  gedung: string;
  ruang: string;
  keterangan: string;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockViewRow {
  item_id: string;
  kode: string;
  nama: string;
  satuan: string;
  kategori: string;
  stok_awal: number;
  total_masuk: number;
  total_keluar: number;
  penyesuaian: number;
  stok: number;
}

export interface RecalcRow {
  item_id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok_tersimpan: number;
  stok_hitung: number;
  selisih: number;
  stok_awal: number;
  total_masuk: number;
  total_keluar: number;
  penyesuaian: number;
}

export interface RecalcReport {
  total_barang: number;
  tidak_sesuai: number;
  rows: RecalcRow[];
}

export interface Transaction {
  id: string;
  nomor: string;
  jenis: "masuk" | "keluar" | "penyesuaian";
  tanggal: string; // YYYY-MM-DD
  item_id: string;
  kode_barang: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  jumlah: number;
  harga_satuan: number;
  total_harga: number;
  sumber_dana: string;
  nomor_dokumen: string;
  tujuan: string;
  penerima: string;
  keperluan: string;
  lokasi: string;
  kondisi: string;
  keterangan: string;
  status: string; // active | cancelled
  deleted_at: string | null;
  opname_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  jenis: string;
  tanggal: string;
  item_id: string;
  jumlah: number;
  harga_satuan: number;
  sumber_dana: string;
  nomor_dokumen: string;
  tujuan: string;
  penerima: string;
  keperluan: string;
  kondisi: string;
  lokasi: string;
  keterangan: string;
}

export interface TransactionBatchLine {
  item_id: string;
  jumlah: number;
  harga_satuan: number;
  keterangan: string;
}

export interface TransactionBatchInput {
  jenis: string;
  tanggal: string;
  penerima: string;
  keperluan: string;
  tujuan: string;
  nomor_dokumen: string;
  sumber_dana: string;
  lokasi: string;
  kondisi: string;
  keterangan: string;
  lines: TransactionBatchLine[];
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  total_unit: number;
  total_nilai: number;
}

export interface OpnameDetail {
  item_id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  keterangan: string;
}

export interface OpnameItemIn {
  item_id: string;
  stok_fisik: number;
  keterangan: string;
}

export interface Opname {
  id: string;
  nomor: string;
  tanggal: string;
  lokasi: string;
  kategori: string;
  petugas: string;
  status: "draft" | "disesuaikan";
  details: OpnameDetail[];
  user_id: string;
  user_name: string;
  created_at: string;
  adjusted_at: string | null;
}

export interface KartuStokRow {
  tanggal: string;
  nomor: string;
  keterangan: string;
  masuk: number;
  keluar: number;
  penyesuaian: number;
  saldo: number;
  petugas: string;
}

export interface KartuStok {
  item: Item;
  saldo_awal: number;
  rows: KartuStokRow[];
  total_masuk: number;
  total_keluar: number;
  total_penyesuaian: number;
  saldo_akhir: number;
}

export interface MutasiRow {
  item_id: string;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  lokasi: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  penyesuaian: number;
  stok_akhir: number;
}

export interface SchoolProfile {
  nama_sekolah: string;
  npsn: string;
  alamat: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  kode_pos: string;
  telepon: string;
  email: string;
  website: string;
  kepala_sekolah: string;
  nip_kepala: string;
  pengurus_barang: string;
  nip_pengurus: string;
  logo: string;
}

export interface MonthPoint {
  bulan: string;
  label: string;
  masuk: number;
  keluar: number;
}

export interface NamedCount {
  nama: string;
  jumlah: number;
}

export interface StokKategori {
  kategori: string;
  stok: number;
  jenis_count: number;
}

export interface DashboardData {
  total_jenis: number;
  total_persediaan: number;
  total_inventaris: number;
  total_unit: number;
  masuk_bulan_ini: number;
  keluar_bulan_ini: number;
  stok_menipis: number;
  stok_habis: number;
  tren_bulanan: MonthPoint[];
  stok_kategori: StokKategori[];
  jumlah_jenis: NamedCount[];
  kondisi: NamedCount[];
  transaksi_terbaru: Transaction[];
}

export interface AuditEntry {
  id: string;
  waktu: string;
  user_id: string;
  user_name: string;
  role: string;
  aksi: string;
  entitas: string;
  entitas_id: string;
  detail: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
}

export interface ImportRow {
  baris: number;
  kode: string;
  nama: string;
  jenis: string;
  kategori: string;
  merk: string;
  tipe_model: string;
  spesifikasi: string;
  satuan: string;
  tahun: number | null;
  sumber_dana: string;
  lokasi: string;
  kondisi: string;
  nomor_seri: string;
  nup: string;
  stok: number;
  stok_minimum: number;
  harga_satuan: number;
  keterangan: string;
  status: "valid" | "duplikat" | "error";
  pesan: string;
  existing_id: string;
}

export interface ImportPreview {
  total: number;
  valid: number;
  duplikat: number;
  error: number;
  rows: ImportRow[];
}

export interface ImportCommit {
  mode: "tambah" | "update" | "lewati";
  rows: ImportRow[];
}

export interface ImportResult {
  berhasil: number;
  diperbarui: number;
  dilewati: number;
  gagal: number;
  pesan: string[];
}

export interface UserCreateInput {
  nama: string;
  username: string;
  email: string;
  password: string;
  role: string;
  nip: string;
}
