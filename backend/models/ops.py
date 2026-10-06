"""Stok opname, audit trail, dashboard and Excel-import models."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.base import BaseDoc, new_id, now_utc
from models.inventory import Item, Transaction


# --- Stok opname ---


class OpnameItemIn(BaseModel):
    item_id: str
    stok_fisik: int
    keterangan: str = ""


class OpnameIn(BaseModel):
    tanggal: str
    lokasi: str = ""
    kategori: str = ""
    petugas: str = ""
    items: list[OpnameItemIn] = []


class OpnameDetail(BaseModel):
    item_id: str = ""
    kode: str = ""
    nama: str = ""
    satuan: str = ""
    stok_sistem: int = 0
    stok_fisik: int = 0
    selisih: int = 0
    keterangan: str = ""


class Opname(BaseDoc):
    id: str = Field(default_factory=new_id)
    nomor: str  # SO-2026-0001
    tanggal: str
    lokasi: str = ""
    kategori: str = ""
    petugas: str = ""
    status: str = "draft"  # draft | disesuaikan
    details: list[OpnameDetail] = []
    user_id: str = ""
    user_name: str = ""
    created_at: datetime = Field(default_factory=now_utc)
    adjusted_at: datetime | None = None


class OpnameUpdate(BaseModel):
    tanggal: str = ""
    lokasi: str = ""
    kategori: str = ""
    petugas: str = ""
    details: list[OpnameDetail] = []


# --- Audit trail ---


class AuditEntry(BaseDoc):
    id: str = Field(default_factory=new_id)
    waktu: datetime = Field(default_factory=now_utc)
    user_id: str = ""
    user_name: str = ""
    role: str = ""
    aksi: str = ""
    entitas: str = ""
    entitas_id: str = ""
    detail: str = ""
    old_data: dict = {}
    new_data: dict = {}
    ip_address: str = ""
    user_agent: str = ""


class AuditCreate(BaseModel):
    aksi: str
    detail: str = ""


# --- Dashboard ---


class MonthPoint(BaseModel):
    bulan: str = ""
    label: str = ""
    masuk: int = 0
    keluar: int = 0


class NamedCount(BaseModel):
    nama: str = ""
    jumlah: int = 0


class StokKategori(BaseModel):
    kategori: str = ""
    stok: int = 0
    jenis_count: int = 0


class DashboardData(BaseModel):
    total_jenis: int = 0
    total_persediaan: int = 0
    total_inventaris: int = 0
    total_unit: int = 0
    masuk_bulan_ini: int = 0
    keluar_bulan_ini: int = 0
    stok_menipis: int = 0
    stok_habis: int = 0
    tren_bulanan: list[MonthPoint] = []
    stok_kategori: list[StokKategori] = []
    jumlah_jenis: list[NamedCount] = []
    kondisi: list[NamedCount] = []
    transaksi_terbaru: list[Transaction] = []


# --- Import Excel ---


class ImportRow(BaseModel):
    baris: int = 0
    kode: str = ""
    nama: str = ""
    jenis: str = "persediaan"
    kategori: str = ""
    merk: str = ""
    tipe_model: str = ""
    spesifikasi: str = ""
    satuan: str = ""
    tahun: int | None = None
    sumber_dana: str = ""
    lokasi: str = ""
    kondisi: str = "Baik"
    nomor_seri: str = ""
    nup: str = ""
    stok: int = 0
    stok_minimum: int = 5
    harga_satuan: float = 0
    keterangan: str = ""
    status: str = "valid"  # valid | duplikat | error
    pesan: str = ""
    existing_id: str = ""


class ImportPreview(BaseModel):
    total: int = 0
    valid: int = 0
    duplikat: int = 0
    error: int = 0
    rows: list[ImportRow] = []


class ImportCommit(BaseModel):
    mode: str = "tambah"  # tambah | update | lewati
    rows: list[ImportRow] = []


class ImportResult(BaseModel):
    berhasil: int = 0
    diperbarui: int = 0
    dilewati: int = 0
    gagal: int = 0
    pesan: list[str] = []
