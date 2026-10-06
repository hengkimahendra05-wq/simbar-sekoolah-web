"""Auth primitives: bcrypt hashing, JWT session cookie, FastAPI dependencies."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db

COOKIE_NAME = "simbara_session"
SESSION_DAYS = 7
_SECRET = os.environ.get("SESSION_SECRET", "simbara-sekolah-dev-secret")
_ALGO = "HS256"

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    return jwt.encode(payload, _SECRET, algorithm=_ALGO)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_DAYS * 24 * 3600, httponly=True, samesite="lax", path="/"
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Silakan login terlebih dahulu")
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi berakhir. Silakan login kembali.")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user or not user.get("aktif", True):
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan atau dinonaktifkan")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya Administrator yang memiliki akses")
    return user
