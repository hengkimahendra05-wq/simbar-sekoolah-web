"""School profile: used automatically on report letterheads (kop surat)."""

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.helpers import log_action
from lib.security import get_current_user, require_admin
from models.core import SchoolProfile

router = APIRouter(tags=["profil-sekolah"])


@router.get("/school-profile", response_model=SchoolProfile)
async def get_school_profile(_: dict = Depends(get_current_user)):
    doc = await db.school_profile.find_one({"id": "profil"})
    return SchoolProfile(**doc) if doc else SchoolProfile()


@router.put("/school-profile", response_model=SchoolProfile)
async def update_school_profile(body: SchoolProfile, user: dict = Depends(require_admin)):
    if len(body.logo) > 1_500_000:
        raise HTTPException(status_code=400, detail="Ukuran logo terlalu besar (maksimal ±1 MB)")
    data = body.model_dump()
    await db.school_profile.update_one({"id": "profil"}, {"$set": data, "$setOnInsert": {"id": "profil"}}, upsert=True)
    await log_action(user, "UPDATE", "school_profile", "profil", body.nama_sekolah)
    doc = await db.school_profile.find_one({"id": "profil"})
    return SchoolProfile(**doc)
