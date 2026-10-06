"""User management (Administrator only)."""

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.helpers import log_action, now_utc
from lib.security import hash_password, require_admin
from models.base import new_id
from models.core import UserCreate, UserOut, UserUpdate

router = APIRouter(tags=["pengguna"])


async def _last_admin_guard(user_id: str, field_check: bool) -> None:
    """Pastikan selalu ada minimal satu Administrator aktif."""
    query: dict = {"role": "admin", "aktif": True, "id": {"$ne": user_id}}
    others = await db.users.count_documents(query)
    if others == 0:
        raise HTTPException(status_code=400, detail="Minimal satu Administrator aktif harus ada")


@router.get("/users", response_model=list[UserOut])
async def list_users(_: dict = Depends(require_admin)):
    docs = await db.users.find().sort([("created_at", 1)]).to_list(1000)
    return [UserOut(**d) for d in docs]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, user: dict = Depends(require_admin)):
    nama = body.nama.strip()
    username = body.username.strip().lower()
    email = body.email.strip().lower()
    if not nama or not username:
        raise HTTPException(status_code=400, detail="Nama dan username wajib diisi")
    if len(body.password) < 5:
        raise HTTPException(status_code=400, detail="Password minimal 5 karakter")
    if body.role not in {"admin", "pengurus"}:
        raise HTTPException(status_code=400, detail="Role harus 'admin' atau 'pengurus'")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah digunakan")
    doc = {
        "id": new_id(),
        "nama": nama,
        "username": username,
        "email": email,
        "role": body.role,
        "nip": body.nip.strip(),
        "foto": "",
        "aktif": True,
        "password_hash": hash_password(body.password),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.users.insert_one(doc)
    await log_action(user, "CREATE", "users", doc["id"], f"{username} ({body.role})", new_data=doc)
    return UserOut(**doc)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    updates: dict = {}
    if body.nama is not None:
        nama = body.nama.strip()
        if not nama:
            raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
        updates["nama"] = nama
    if body.nip is not None:
        updates["nip"] = body.nip.strip()
    if body.username is not None and body.username.strip():
        username = body.username.strip().lower()
        clash = await db.users.find_one({"username": username, "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        updates["username"] = username
    if body.email is not None:
        email = body.email.strip().lower()
        if email:
            clash = await db.users.find_one({"email": email, "id": {"$ne": user_id}})
            if clash:
                raise HTTPException(status_code=400, detail="Email sudah digunakan")
        updates["email"] = email
    if body.role is not None:
        if body.role not in {"admin", "pengurus"}:
            raise HTTPException(status_code=400, detail="Role tidak valid")
        if target["role"] == "admin" and body.role != "admin":
            await _last_admin_guard(user_id, True)
        updates["role"] = body.role
    if body.aktif is not None:
        if not body.aktif:
            if user_id == user["id"]:
                raise HTTPException(status_code=400, detail="Tidak dapat menonaktifkan akun Anda sendiri")
            if target["role"] == "admin":
                await _last_admin_guard(user_id, True)
        updates["aktif"] = body.aktif
    if body.password:
        if len(body.password) < 5:
            raise HTTPException(status_code=400, detail="Password minimal 5 karakter")
        updates["password_hash"] = hash_password(body.password)
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    updates["updated_at"] = now_utc()
    await db.users.update_one({"id": user_id}, {"$set": updates})
    fresh = await db.users.find_one({"id": user_id})
    await log_action(user, "UPDATE", "users", user_id, f"{target['username']}", old_data=target, new_data=fresh)
    return UserOut(**fresh)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun Anda sendiri")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if target["role"] == "admin" and target.get("aktif", True):
        await _last_admin_guard(user_id, True)
    await db.users.delete_one({"id": user_id})
    await log_action(user, "DELETE", "users", user_id, f"{target['username']}", old_data=target)
    return {"message": f"Akun {target['username']} dihapus"}
