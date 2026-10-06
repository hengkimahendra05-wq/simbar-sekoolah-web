"""Master data: kategori & lokasi/ruang (§B.3, §B.4). Baca untuk semua, ubah untuk Administrator."""

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.db import db
from lib.helpers import log_action, now_utc
from lib.security import get_current_user, require_admin
from models.base import new_id
from models.masters import Category, CategoryIn, Location, LocationIn

router = APIRouter(tags=["master-data"])


# --- Kategori ---


@router.get("/categories", response_model=list[Category])
async def list_categories(_: dict = Depends(get_current_user)):
    docs = await db.categories.find({"aktif": True}).sort([("nama", 1)]).to_list(500)
    return [Category(**d) for d in docs]


@router.post("/categories", response_model=Category, status_code=201)
async def create_category(body: CategoryIn, request: Request, user: dict = Depends(require_admin)):
    nama = body.nama.strip()
    if not nama:
        raise HTTPException(status_code=400, detail="Nama kategori wajib diisi")
    if await db.categories.find_one({"nama": nama}):
        raise HTTPException(status_code=400, detail="Nama kategori sudah digunakan")
    doc = Category(**{**body.model_dump(), "nama": nama}).model_dump()
    doc["id"] = doc.get("id") or new_id()
    await db.categories.insert_one(doc)
    await log_action(user, "CREATE", "categories", doc["id"], nama, new_data=doc, request=request)
    return Category(**doc)


@router.put("/categories/{cat_id}", response_model=Category)
async def update_category(cat_id: str, body: CategoryIn, request: Request, user: dict = Depends(require_admin)):
    old = await db.categories.find_one({"id": cat_id})
    if not old:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    nama = body.nama.strip()
    if not nama:
        raise HTTPException(status_code=400, detail="Nama kategori wajib diisi")
    clash = await db.categories.find_one({"nama": nama, "id": {"$ne": cat_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Nama kategori sudah digunakan")
    updates = {**body.model_dump(), "nama": nama, "updated_at": now_utc()}
    await db.categories.update_one({"id": cat_id}, {"$set": updates})
    # Nama kategori tersimpan denormalisasi pada barang & transaksi — ikut diperbarui agar konsisten.
    if old["nama"] != nama:
        await db.items.update_many({"kategori": old["nama"]}, {"$set": {"kategori": nama}})
        await db.item_transactions.update_many({"kategori": old["nama"]}, {"$set": {"kategori": nama}})
    fresh = await db.categories.find_one({"id": cat_id})
    await log_action(user, "UPDATE", "categories", cat_id, nama, old_data=old, new_data=fresh, request=request)
    return Category(**fresh)


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request, user: dict = Depends(require_admin)):
    doc = await db.categories.find_one({"id": cat_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    used = await db.items.count_documents({"kategori": doc["nama"], "deleted_at": None})
    if used:
        raise HTTPException(
            status_code=400,
            detail=f"Kategori masih dipakai oleh {used} barang. Pindahkan barang tersebut terlebih dahulu.",
        )
    await db.categories.update_one({"id": cat_id}, {"$set": {"aktif": False, "updated_at": now_utc()}})
    await log_action(user, "DELETE", "categories", cat_id, doc["nama"], old_data=doc, request=request)
    return {"message": f"Kategori {doc['nama']} dinonaktifkan"}


# --- Lokasi / Ruang ---


@router.get("/locations", response_model=list[Location])
async def list_locations(_: dict = Depends(get_current_user)):
    docs = await db.locations.find({"aktif": True}).sort([("nama", 1)]).to_list(1000)
    return [Location(**d) for d in docs]


@router.post("/locations", response_model=Location, status_code=201)
async def create_location(body: LocationIn, request: Request, user: dict = Depends(require_admin)):
    nama = body.nama.strip()
    if not nama:
        raise HTTPException(status_code=400, detail="Nama lokasi/ruang wajib diisi")
    if await db.locations.find_one({"nama": nama}):
        raise HTTPException(status_code=400, detail="Nama lokasi/ruang sudah digunakan")
    doc = Location(**{**body.model_dump(), "nama": nama}).model_dump()
    doc["id"] = doc.get("id") or new_id()
    await db.locations.insert_one(doc)
    await log_action(user, "CREATE", "locations", doc["id"], nama, new_data=doc, request=request)
    return Location(**doc)


@router.put("/locations/{loc_id}", response_model=Location)
async def update_location(loc_id: str, body: LocationIn, request: Request, user: dict = Depends(require_admin)):
    old = await db.locations.find_one({"id": loc_id})
    if not old:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    nama = body.nama.strip()
    if not nama:
        raise HTTPException(status_code=400, detail="Nama lokasi/ruang wajib diisi")
    clash = await db.locations.find_one({"nama": nama, "id": {"$ne": loc_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Nama lokasi/ruang sudah digunakan")
    await db.locations.update_one({"id": loc_id}, {"$set": {**body.model_dump(), "nama": nama, "updated_at": now_utc()}})
    if old["nama"] != nama:
        await db.items.update_many({"lokasi": old["nama"]}, {"$set": {"lokasi": nama}})
    fresh = await db.locations.find_one({"id": loc_id})
    await log_action(user, "UPDATE", "locations", loc_id, nama, old_data=old, new_data=fresh, request=request)
    return Location(**fresh)


@router.delete("/locations/{loc_id}")
async def delete_location(loc_id: str, request: Request, user: dict = Depends(require_admin)):
    doc = await db.locations.find_one({"id": loc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    used = await db.items.count_documents({"lokasi": doc["nama"], "deleted_at": None})
    if used:
        raise HTTPException(
            status_code=400,
            detail=f"Lokasi masih dipakai oleh {used} barang. Pindahkan barang tersebut terlebih dahulu.",
        )
    await db.locations.update_one({"id": loc_id}, {"$set": {"aktif": False, "updated_at": now_utc()}})
    await log_action(user, "DELETE", "locations", loc_id, doc["nama"], old_data=doc, request=request)
    return {"message": f"Lokasi {doc['nama']} dinonaktifkan"}
