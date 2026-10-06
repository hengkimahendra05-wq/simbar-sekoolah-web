"""Item master and stock-transaction models."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.base import BaseDoc, new_id, now_utc


class Item(BaseDoc):
    id: str = Field(default_factory=new_id)
    kode: str = ""
    nama: str
    jenis: str = "persediaan"  # persediaan | inventaris
    kategori: str = "Lainnya"
    merk: str = ""
    tipe_model: str = ""
    spesifikasi: str = ""
    satuan: str = "Buah"
    tahun: int | None = None
    sumber_dana: str = ""
    lokasi: str = ""
    kondisi: str = "Baik"  # Baik | Rusak Ringan | Rusak Berat
    status: str = "aktif"  # aktif | tidak_aktif | arsip
    nomor_seri: str = ""
    nup: str = ""
    stok_awal: int = 0
    stok_minimum: int = 5
    harga_satuan: float = 0
    keterangan: str = ""
    stok: int = 0  # cache: stok_awal + masuk - keluar + penyesuaian (selalu hasil recalc_stock)
    archived: bool = False
    deleted_at: datetime | None = None
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class ItemIn(BaseModel):
    kode: str = ""  # kosong = kode otomatis BRG-xxxx
    nama: str
    jenis: str = "persediaan"
    kategori: str = "Lainnya"
    merk: str = ""
    tipe_model: str = ""
    spesifikasi: str = ""
    satuan: str = "Buah"
    tahun: int | None = None
    sumber_dana: str = ""
    lokasi: str = ""
    kondisi: str = "Baik"
    status: str = "aktif"
    nomor_seri: str = ""
    nup: str = ""
    stok_awal: int = 0
    stok_minimum: int = 5
    harga_satuan: float = 0
    keterangan: str = ""


class ItemPage(BaseModel):
    items: list[Item] = []
    total: int = 0
    page: int = 1
    per_page: int = 10
    pages: int = 1


class Transaction(BaseDoc):
    id: str = Field(default_factory=new_id)
    nomor: str  # BM-2026-0001 / BK-2026-0001 / ADJ-2026-0001
    jenis: str  # masuk | keluar | penyesuaian
    tanggal: str  # YYYY-MM-DD
    item_id: str
    kode_barang: str = ""
    nama_barang: str = ""
    kategori: str = ""
    satuan: str = ""
    jumlah: int = 0  # penyesuaian boleh bernilai negatif
    harga_satuan: float = 0
    total_harga: float = 0
    sumber_dana: str = ""
    nomor_dokumen: str = ""
    tujuan: str = ""
    penerima: str = ""
    keperluan: str = ""
    lokasi: str = ""
    kondisi: str = ""
    keterangan: str = ""
    status: str = "active"  # active | cancelled
    deleted_at: datetime | None = None
    opname_id: str = ""
    user_id: str = ""
    user_name: str = ""
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class TransactionIn(BaseModel):
    jenis: str
    tanggal: str
    item_id: str
    jumlah: int
    harga_satuan: float = 0
    sumber_dana: str = ""
    nomor_dokumen: str = ""
    tujuan: str = ""
    penerima: str = ""
    keperluan: str = ""
    kondisi: str = ""
    lokasi: str = ""
    keterangan: str = ""


class TransactionBatchLine(BaseModel):
    """Satu baris barang dalam satu transaksi multi-barang."""

    item_id: str
    jumlah: int
    harga_satuan: float = 0
    keterangan: str = ""


class TransactionBatchIn(BaseModel):
    """Satu transaksi (satu nomor) dengan beberapa jenis barang sekaligus."""

    jenis: str
    tanggal: str
    penerima: str = ""
    keperluan: str = ""
    tujuan: str = ""
    nomor_dokumen: str = ""
    sumber_dana: str = ""
    lokasi: str = ""
    kondisi: str = ""
    keterangan: str = ""
    lines: list[TransactionBatchLine] = []


class TransactionUpdate(BaseModel):
    tanggal: str | None = None
    jumlah: int | None = None
    harga_satuan: float | None = None
    sumber_dana: str | None = None
    nomor_dokumen: str | None = None
    tujuan: str | None = None
    penerima: str | None = None
    keperluan: str | None = None
    kondisi: str | None = None
    lokasi: str | None = None
    keterangan: str | None = None


class TransactionPage(BaseModel):
    items: list[Transaction] = []
    total: int = 0
    page: int = 1
    per_page: int = 10
    pages: int = 1
    total_unit: int = 0
    total_nilai: float = 0


class KartuStokRow(BaseModel):
    tanggal: str = ""
    nomor: str = ""
    keterangan: str = ""
    masuk: int = 0
    keluar: int = 0
    penyesuaian: int = 0
    saldo: int = 0
    petugas: str = ""


class KartuStok(BaseModel):
    item: Item
    saldo_awal: int = 0
    rows: list[KartuStokRow] = []
    total_masuk: int = 0
    total_keluar: int = 0
    total_penyesuaian: int = 0
    saldo_akhir: int = 0


class MutasiRow(BaseModel):
    item_id: str = ""
    kode: str = ""
    nama: str = ""
    kategori: str = ""
    satuan: str = ""
    lokasi: str = ""
    stok_awal: int = 0
    masuk: int = 0
    keluar: int = 0
    penyesuaian: int = 0
    stok_akhir: int = 0


class StockViewRow(BaseModel):
    """current_stock_view (§C)."""

    item_id: str = ""
    kode: str = ""
    nama: str = ""
    satuan: str = ""
    kategori: str = ""
    stok_awal: int = 0
    total_masuk: int = 0
    total_keluar: int = 0
    penyesuaian: int = 0
    stok: int = 0


class RecalcRow(BaseModel):
    item_id: str = ""
    kode: str = ""
    nama: str = ""
    satuan: str = ""
    stok_tersimpan: int = 0
    stok_hitung: int = 0
    selisih: int = 0
    stok_awal: int = 0
    total_masuk: int = 0
    total_keluar: int = 0
    penyesuaian: int = 0


class RecalcReport(BaseModel):
    total_barang: int = 0
    tidak_sesuai: int = 0
    rows: list[RecalcRow] = []
