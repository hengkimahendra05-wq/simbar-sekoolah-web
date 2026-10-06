"""Authentication: login, logout, session (httpOnly cookie), own-profile management."""

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.db import db
from lib.helpers import log_action, now_utc
from lib.security import (
    clear_session_cookie,
    create_token,
    get_current_user,
    hash_password,
    set_session_cookie,
    verify_password,
)
from models.core import LoginIn, ProfileUpdate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response):
    ident = body.username.strip().lower()
    user = await db.users.find_one({"$or": [{"username": ident}, {"email": ident}]})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.get("aktif", True):
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan. Hubungi Administrator.")
    set_session_cookie(response, create_token(user["id"]))
    await log_action(user, "LOGIN", "users", user["id"], "Berhasil masuk ke aplikasi")
    return UserOut(**user)


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"message": "Logout berhasil"}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@router.put("/profile", response_model=UserOut)
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates: dict = {}
    if body.nama is not None:
        nama = body.nama.strip()
        if not nama:
            raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
        updates["nama"] = nama
    if body.username is not None and body.username.strip():
        username = body.username.strip().lower()
        clash = await db.users.find_one({"username": username, "id": {"$ne": user["id"]}})
        if clash:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        updates["username"] = username
    if body.email is not None:
        email = body.email.strip().lower()
        if email:
            clash = await db.users.find_one({"email": email, "id": {"$ne": user["id"]}})
            if clash:
                raise HTTPException(status_code=400, detail="Email sudah digunakan")
        updates["email"] = email
    if body.foto is not None:
        if len(body.foto) > 1_500_000:
            raise HTTPException(status_code=400, detail="Ukuran foto terlalu besar (maksimal ±1 MB)")
        updates["foto"] = body.foto
    if body.new_password:
        if len(body.new_password) < 5:
            raise HTTPException(status_code=400, detail="Password baru minimal 5 karakter")
        if not body.current_password or not verify_password(body.current_password, user.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Password saat ini salah")
        updates["password_hash"] = hash_password(body.new_password)
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    updates["updated_at"] = now_utc()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    await log_action(user, "UPDATE", "users", user["id"], "Memperbarui profil sendiri")
    return UserOut(**fresh)
