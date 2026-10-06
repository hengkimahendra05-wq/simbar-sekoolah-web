"""Master data kategori & lokasi/ruang."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.base import BaseDoc, new_id, now_utc


class CategoryIn(BaseModel):
    kode: str = ""
    nama: str
    keterangan: str = ""


class Category(BaseDoc):
    id: str = Field(default_factory=new_id)
    kode: str = ""
    nama: str
    keterangan: str = ""
    aktif: bool = True
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class LocationIn(BaseModel):
    kode: str = ""
    nama: str
    gedung: str = ""
    ruang: str = ""
    keterangan: str = ""


class Location(BaseDoc):
    id: str = Field(default_factory=new_id)
    kode: str = ""
    nama: str
    gedung: str = ""
    ruang: str = ""
    keterangan: str = ""
    aktif: bool = True
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
