"""Cross-router helpers: audit logging, safe numbering, and the single source of truth for stock.

Stock is never a free-standing editable number. `recalc_stock()` recomputes it from the
transaction history every time anything changes:

    stok = stok_awal + Σ(masuk) − Σ(keluar) + Σ(penyesuaian, signed)

Only transactions with status "active" count — a deleted transaction is soft-deleted
(status "cancelled" + deleted_at) so the history survives while its stock effect disappears.
"""

import re
from datetime import datetime
from typing import Any

from fastapi import Request
from pymongo.errors import DuplicateKeyError

from lib.db import db
from models.base import new_id, now_utc

# Prefix nomor transaksi per jenis (lihat spesifikasi §R).
PREFIX = {"masuk": "BM", "keluar": "BK", "penyesuaian": "ADJ"}
ACTIVE = {"status": "active"}


async def log_action(
    user: dict,
    aksi: str,
    entitas: str,
    entitas_id: str = "",
    detail: str = "",
    old_data: dict | None = None,
    new_data: dict | None = None,
    request: Request | None = None,
) -> None:
    """Write one audit-trail entry. Never raises — logging must not break a mutation."""
    try:
        await db.audit_logs.insert_one(
            {
                "id": new_id(),
                "waktu": now_utc(),
                "user_id": user.get("id", ""),
                "user_name": user.get("nama", ""),
                "role": user.get("role", ""),
                "aksi": aksi,
                "entitas": entitas,
                "entitas_id": entitas_id,
                "detail": detail,
                "old_data": _clean(old_data),
                "new_data": _clean(new_data),
                "ip_address": (request.client.host if request and request.client else ""),
                "user_agent": (request.headers.get("user-agent", "")[:300] if request else ""),
            }
        )
    except Exception:  # noqa: BLE001
        pass


def _clean(data: dict | None) -> dict:
    """Keep audit snapshots small and JSON-safe (no _id, no huge base64 blobs)."""
    if not data:
        return {}
    out: dict[str, Any] = {}
    for k, v in data.items():
        if k in {"_id", "password_hash", "logo", "foto", "photo"}:
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v if not isinstance(v, str) or len(v) <= 300 else v[:300]
    return out


async def next_kode(session=None) -> str:
    """Next item code BRG-0001, BRG-0002, ... (collision-safe with the unique index)."""
    last = await db.items.find_one({"kode": {"$regex": r"^BRG-\d+$"}}, sort=[("kode", -1)], session=session)
    seq = int(last["kode"].split("-")[1]) + 1 if last else 1
    kode = f"BRG-{seq:04d}"
    while await db.items.find_one({"kode": kode}, session=session):
        seq += 1
        kode = f"BRG-{seq:04d}"
    return kode


async def next_nomor(collection: str, prefix: str, year: int, session=None) -> str:
    """Next transaction number, e.g. BM-2026-0001. Zero-padded so lexical sort works."""
    pattern = rf"^{re.escape(prefix)}-{year}-\d+$"
    last = await db[collection].find_one({"nomor": {"$regex": pattern}}, sort=[("nomor", -1)], session=session)
    seq = int(last["nomor"].rsplit("-", 1)[1]) + 1 if last else 1
    nomor = f"{prefix}-{year}-{seq:04d}"
    while await db[collection].find_one({"nomor": nomor}, session=session):
        seq += 1
        nomor = f"{prefix}-{year}-{seq:04d}"
    return nomor


async def compute_stock(item_id: str, stok_awal: int | None = None, session=None) -> dict:
    """calculateCurrentStock(item_id) — derive stock purely from active transaction history."""
    if stok_awal is None:
        item = await db.items.find_one({"id": item_id}, {"stok_awal": 1}, session=session)
        stok_awal = int(item.get("stok_awal", 0)) if item else 0
    groups = await db.item_transactions.aggregate(
        [
            {"$match": {"item_id": item_id, **ACTIVE}},
            {"$group": {"_id": "$jenis", "total": {"$sum": "$jumlah"}}},
        ],
        session=session,
    ).to_list(10)
    by = {g["_id"]: int(g["total"]) for g in groups}
    masuk, keluar, adj = by.get("masuk", 0), by.get("keluar", 0), by.get("penyesuaian", 0)
    return {
        "stok_awal": int(stok_awal),
        "total_masuk": masuk,
        "total_keluar": keluar,
        "penyesuaian": adj,
        "stok": int(stok_awal) + masuk - keluar + adj,
    }


async def recalc_stock(item_id: str, session=None) -> int:
    """Recompute and persist the cached `stok` field. Called after every write that can move stock."""
    calc = await compute_stock(item_id, session=session)
    await db.items.update_one(
        {"id": item_id}, {"$set": {"stok": calc["stok"], "updated_at": now_utc()}}, session=session
    )
    return calc["stok"]


async def current_stock(item_id: str, session=None) -> int:
    """Available stock right now, derived from history (never the cached field)."""
    return (await compute_stock(item_id, session=session))["stok"]


async def insert_with_nomor(collection: str, doc: dict, session=None) -> bool:
    """Insert a doc carrying an auto nomor; retry on a unique-index clash from a concurrent user."""
    for _ in range(5):
        try:
            await db[collection].insert_one(doc, session=session)
            return True
        except DuplicateKeyError:
            prefix, year = doc["nomor"].rsplit("-", 2)[0], int(doc["nomor"].rsplit("-", 2)[1])
            doc["nomor"] = await next_nomor(collection, prefix, year, session=session)
    return False


def build_kartu(item: dict, txs: list[dict], awal: str = "", akhir: str = "") -> dict:
    """Kartu stok: running balance rows (Masuk / Keluar / Penyesuaian / Saldo) + period summary.

    `txs` must already be sorted by tanggal then created_at (spec §K secondary sorting).
    """
    saldo_awal = int(item.get("stok_awal", 0))
    saldo = saldo_awal
    saldo_akhir = saldo_awal
    total_masuk = total_keluar = total_adj = 0
    seen_first = False
    rows: list[dict] = []
    for t in txs:
        jenis = t.get("jenis")
        jumlah = int(t["jumlah"])
        masuk = jumlah if jenis == "masuk" else 0
        keluar = jumlah if jenis == "keluar" else 0
        adj = jumlah if jenis == "penyesuaian" else 0
        delta = masuk - keluar + adj
        saldo += delta
        tanggal = t.get("tanggal", "")
        if not akhir or tanggal <= akhir:
            saldo_akhir = saldo
        if (not awal or tanggal >= awal) and (not akhir or tanggal <= akhir):
            if not seen_first:
                saldo_awal = saldo - delta
                seen_first = True
            ket = t.get("keterangan") or (
                "Penyesuaian stok opname" if adj else ("Pengadaan / penerimaan" if masuk else "Pemakaian / pengeluaran")
            )
            rows.append(
                {
                    "tanggal": tanggal,
                    "nomor": t.get("nomor", ""),
                    "keterangan": ket,
                    "masuk": masuk,
                    "keluar": keluar,
                    "penyesuaian": adj,
                    "saldo": saldo,
                    "petugas": t.get("user_name", ""),
                }
            )
            total_masuk += masuk
            total_keluar += keluar
            total_adj += adj
    return {
        "saldo_awal": saldo_awal,
        "rows": rows,
        "total_masuk": total_masuk,
        "total_keluar": total_keluar,
        "total_penyesuaian": total_adj,
        "saldo_akhir": saldo_akhir,
    }


def fdate(iso: str) -> str:
    """YYYY-MM-DD -> DD/MM/YYYY (neat for Excel/print)."""
    if isinstance(iso, str) and len(iso) >= 10 and iso[4] == "-" and iso[7] == "-":
        return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}"
    return str(iso)
