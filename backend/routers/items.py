"""Item master: CRUD + kartu stok.

`stok` adalah cache hasil `recalc_stock()` — tidak pernah diedit langsung oleh pengguna.
Hapus barang memakai soft delete (§U): `deleted_at` diisi, histori transaksi tetap utuh.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.db import db
from lib.helpers import build_kartu, compute_stock, log_action, next_kode, now_utc, recalc_stock
from lib.security import get_current_user
from models.inventory import Item, ItemIn, ItemPage, KartuStok

router = APIRouter(tags=["barang"])

SORT_FIELDS = {
    "nama": "nama",
    "kode": "kode",
    "stok": "stok",
    "tahun": "tahun",
    "kategori": "kategori",
    "lokasi": "lokasi",
    "created_at": "created_at",
}
MAX_PER_PAGE = 200
KONDISI_VALID = {"Baik", "Rusak Ringan", "Rusak Berat"}


def _rx(value: str) -> dict:
    return {"$regex": re.escape(value.strip()), "$options": "i"}


def item_query(
    q: str,
    jenis: str,
    kategori: str,
    kondisi: str,
    lokasi: str,
    status: str,
    tahun: str = "",
) -> dict:
    """Shared filter builder — dipakai daftar, pagination, dan export Excel."""
    query: dict = {}
    if status == "arsip":
        query["deleted_at"] = {"$ne": None}
    else:
        query["deleted_at"] = None
    if jenis:
        query["jenis"] = jenis
    if kategori:
        query["kategori"] = kategori
    if kondisi:
        query["kondisi"] = kondisi
    if lokasi:
        query["lokasi"] = lokasi
    if tahun:
        try:
            query["tahun"] = int(tahun)
        except ValueError:
            pass
    if q:
        query["$or"] = [
            {"nama": _rx(q)},
            {"kode": _rx(q)},
            {"merk": _rx(q)},
            {"nomor_seri": _rx(q)},
            {"keterangan": _rx(q)},
        ]
    if status == "menipis":
        query["$expr"] = {"$and": [{"$gt": ["$stok", 0]}, {"$lte": ["$stok", "$stok_minimum"]}]}
    elif status == "habis":
        query["stok"] = {"$lte": 0}
    return query


async def _validate_item(body: ItemIn, item_id: str = "") -> dict:
    """Validasi data barang (§N) + normalisasi kode."""
    nama = body.nama.strip()
    if not nama:
        raise HTTPException(status_code=400, detail="Nama barang wajib diisi")
    if not body.kategori.strip():
        raise HTTPException(status_code=400, detail="Kategori wajib dipilih")
    if not body.satuan.strip():
        raise HTTPException(status_code=400, detail="Satuan wajib diisi")
    if body.harga_satuan < 0:
        raise HTTPException(status_code=400, detail="Harga tidak boleh negatif")
    if body.stok_awal < 0:
        raise HTTPException(status_code=400, detail="Stok awal tidak boleh negatif")
    if body.stok_minimum < 0:
        raise HTTPException(status_code=400, detail="Stok minimum tidak boleh negatif")
    if body.kondisi not in KONDISI_VALID:
        raise HTTPException(status_code=400, detail="Kondisi tidak valid")
    if body.tahun is not None and not (1900 <= body.tahun <= 2100):
        raise HTTPException(status_code=400, detail="Tahun perolehan tidak valid")
    data = body.model_dump()
    data["nama"] = nama
    kode = body.kode.strip().upper()
    if kode:
        clash = await db.items.find_one({"kode": kode, **({"id": {"$ne": item_id}} if item_id else {})})
        if clash:
            raise HTTPException(
                status_code=400, detail="Kode barang sudah digunakan. Silakan gunakan kode yang berbeda."
            )
    data["kode"] = kode
    return data


@router.get("/items/lokasi")
async def list_lokasi(_: dict = Depends(get_current_user)) -> list[str]:
    values = await db.items.distinct("lokasi", {"deleted_at": None})
    return sorted(v for v in values if v)


@router.get("/items/tahun")
async def list_tahun(_: dict = Depends(get_current_user)) -> list[int]:
    values = await db.items.distinct("tahun", {"deleted_at": None})
    return sorted((int(v) for v in values if v), reverse=True)


@router.get("/items", response_model=list[Item])
async def list_items(
    q: str = "",
    jenis: str = "",
    kategori: str = "",
    kondisi: str = "",
    lokasi: str = "",
    status: str = "",
    tahun: str = "",
    sort: str = "nama",
    dir: str = "asc",
    limit: int = 50000,
    _: dict = Depends(get_current_user),
):
    """Full list (dropdown, laporan, export). Gunakan /items/paged untuk tabel besar."""
    key = SORT_FIELDS.get(sort, "nama")
    order = -1 if dir == "desc" else 1
    docs = (
        await db.items.find(item_query(q, jenis, kategori, kondisi, lokasi, status, tahun))
        .sort([(key, order)])
        .to_list(limit)
    )
    return [Item(**d) for d in docs]


@router.get("/items/paged", response_model=ItemPage)
async def list_items_paged(
    q: str = "",
    jenis: str = "",
    kategori: str = "",
    kondisi: str = "",
    lokasi: str = "",
    status: str = "",
    tahun: str = "",
    sort: str = "nama",
    dir: str = "asc",
    page: int = 1,
    per_page: int = 10,
    _: dict = Depends(get_current_user),
):
    """Server-side search + pagination (§V/§AC) — tetap cepat pada puluhan ribu barang."""
    query = item_query(q, jenis, kategori, kondisi, lokasi, status, tahun)
    key = SORT_FIELDS.get(sort, "nama")
    order = -1 if dir == "desc" else 1
    per_page = min(max(per_page, 1), MAX_PER_PAGE)
    page = max(page, 1)
    total = await db.items.count_documents(query)
    docs = (
        await db.items.find(query)
        .sort([(key, order)])
        .skip((page - 1) * per_page)
        .limit(per_page)
        .to_list(per_page)
    )
    return ItemPage(
        items=[Item(**d) for d in docs],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, (total + per_page - 1) // per_page),
    )


@router.post("/items", response_model=Item, status_code=201)
async def create_item(body: ItemIn, request: Request, user: dict = Depends(get_current_user)):
    data = await _validate_item(body)
    item = Item(**data)
    item.kode = data["kode"] or await next_kode()
    item.stok = item.stok_awal
    item.created_by = user["id"]
    item.updated_by = user["id"]
    doc = item.model_dump()
    await db.items.insert_one(doc)
    await log_action(user, "CREATE", "items", item.id, f"{item.kode} — {item.nama}", new_data=doc, request=request)
    return item


@router.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: str, _: dict = Depends(get_current_user)):
    doc = await db.items.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    return Item(**doc)


@router.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: str, body: ItemIn, request: Request, user: dict = Depends(get_current_user)):
    old = await db.items.find_one({"id": item_id})
    if not old:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    data = await _validate_item(body, item_id)
    data["kode"] = data["kode"] or old.get("kode", "")
    data["updated_at"] = now_utc()
    data["updated_by"] = user["id"]
    await db.items.update_one({"id": item_id}, {"$set": data})
    await recalc_stock(item_id)  # stok awal bisa berubah → hitung ulang dari histori
    fresh = await db.items.find_one({"id": item_id})
    await log_action(
        user, "UPDATE", "items", item_id, f"{fresh['kode']} — {fresh['nama']}", old_data=old, new_data=fresh, request=request
    )
    return Item(**fresh)


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Soft delete (§U): barang tidak pernah dihapus permanen agar histori transaksi tetap aman."""
    doc = await db.items.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    if doc.get("deleted_at"):
        raise HTTPException(status_code=400, detail="Barang sudah diarsipkan")
    n = await db.item_transactions.count_documents({"item_id": item_id, "status": "active"})
    await db.items.update_one(
        {"id": item_id},
        {"$set": {"deleted_at": now_utc(), "archived": True, "status": "arsip", "updated_at": now_utc(), "updated_by": user["id"]}},
    )
    await log_action(
        user, "DELETE", "items", item_id, f"{doc['kode']} — {doc['nama']} ({n} riwayat transaksi)", old_data=doc, request=request
    )
    return {
        "archived": True,
        "riwayat": n,
        "message": (
            f"Barang diarsipkan (soft delete). {n} riwayat transaksi tetap tersimpan aman."
            if n
            else "Barang diarsipkan (soft delete) dan tidak lagi tampil pada daftar aktif."
        ),
    }


@router.post("/items/{item_id}/restore", response_model=Item)
async def restore_item(item_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Pulihkan barang yang diarsipkan."""
    doc = await db.items.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    await db.items.update_one(
        {"id": item_id},
        {"$set": {"deleted_at": None, "archived": False, "status": "aktif", "updated_at": now_utc(), "updated_by": user["id"]}},
    )
    await recalc_stock(item_id)
    fresh = await db.items.find_one({"id": item_id})
    await log_action(user, "UPDATE", "items", item_id, f"Pulihkan {doc['kode']} — {doc['nama']}", request=request)
    return Item(**fresh)


@router.get("/items/{item_id}/kartu-stok", response_model=KartuStok)
async def kartu_stok(item_id: str, awal: str = "", akhir: str = "", _: dict = Depends(get_current_user)):
    doc = await db.items.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    txs = (
        await db.item_transactions.find({"item_id": item_id, "status": "active"})
        .sort([("tanggal", 1), ("created_at", 1)])  # §K: tanggal, lalu created_at
        .to_list(100000)
    )
    kartu = build_kartu(doc, txs, awal, akhir)
    return KartuStok(item=Item(**doc), **kartu)
