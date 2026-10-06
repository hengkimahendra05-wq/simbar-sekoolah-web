"""Audit trail: read (admin) + client-side event logging (e.g. 'Cetak')."""

from fastapi import APIRouter, Depends

from lib.db import db
from lib.helpers import log_action
from lib.security import get_current_user, require_admin
from models.ops import AuditCreate, AuditEntry

router = APIRouter(tags=["audit"])


@router.get("/audit", response_model=list[AuditEntry])
async def list_audit(aksi: str = "", limit: int = 300, _: dict = Depends(require_admin)):
    query = {"aksi": aksi} if aksi else {}
    docs = await db.audit_logs.find(query).sort([("waktu", -1)]).to_list(min(max(limit, 1), 1000))
    return [AuditEntry(**d) for d in docs]


@router.post("/audit")
async def create_audit(body: AuditCreate, user: dict = Depends(get_current_user)):
    await log_action(user, body.aksi, "Sistem", detail=body.detail)
    return {"message": "ok"}
