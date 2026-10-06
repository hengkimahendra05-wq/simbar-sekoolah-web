"""Auth, user and school-profile models."""

from datetime import datetime

from pydantic import BaseModel, Field

from models.base import BaseDoc, new_id, now_utc


class UserOut(BaseDoc):
    id: str = Field(default_factory=new_id)
    nama: str = ""
    username: str = ""
    email: str = ""
    role: str = "pengurus"  # admin | pengurus
    nip: str = ""
    foto: str = ""
    aktif: bool = True
    created_at: datetime = Field(default_factory=now_utc)


class LoginIn(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    nama: str
    username: str
    email: str = ""
    password: str
    role: str = "pengurus"
    nip: str = ""


class UserUpdate(BaseModel):
    nama: str | None = None
    username: str | None = None
    email: str | None = None
    role: str | None = None
    aktif: bool | None = None
    password: str | None = None
    nip: str | None = None


class ProfileUpdate(BaseModel):
    nama: str | None = None
    username: str | None = None
    email: str | None = None
    foto: str | None = None
    current_password: str | None = None
    new_password: str | None = None


class SchoolProfile(BaseModel):
    nama_sekolah: str = ""
    npsn: str = ""
    alamat: str = ""
    kelurahan: str = ""
    kecamatan: str = ""
    kota: str = ""
    provinsi: str = ""
    kode_pos: str = ""
    telepon: str = ""
    email: str = ""
    website: str = ""
    kepala_sekolah: str = ""
    nip_kepala: str = ""
    pengurus_barang: str = ""
    nip_pengurus: str = ""
    logo: str = ""  # data URL, dipakai di kop laporan
