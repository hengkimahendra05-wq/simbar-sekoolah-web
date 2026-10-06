"""Stok: current_stock_view, hitung ulang stok (recalculate), dan sinkronisasi (admin)."""

from fastapi import APIRouter, Depends, Request

from lib.db import client, db
from lib.helpers import compute_stock, log_action, now_utc
from lib.security import get_current_user, require_admin
from models.inventory import RecalcReport, RecalcRow, StockViewRow

router = APIRouter(prefix="/stock", tags=["stok"])


@router.get("/view", response_model=list[StockViewRow])
async def stock_view(_: dict = Depends(get_current_user)):
    """current_stock_view (§C): stok awal, total masuk/keluar, penyesuaian, dan stok akhir."""
    items = await db.items.find({"deleted_at": None}).sort([("kode", 1)]).to_list(50000)
    agg = await db.item_transactions.aggregate(
        [
            {"$match": {"status": "active"}},
            {"$group": {"_id": {"item": "$item_id", "jenis": "$jenis"}, "total": {"$sum": "$jumlah"}}},
        ]
    ).to_list(200000)
    per: dict[str, dict[str, int]] = {}
    for a in agg:
        per.setdefault(a["_id"]["item"], {})[a["_id"]["jenis"]] = int(a["total"])
    rows: list[StockViewRow] = []
    for i in items:
        p = per.get(i["id"], {})
        masuk, keluar, adj = p.get("masuk", 0), p.get("keluar", 0), p.get("penyesuaian", 0)
        awal = int(i.get("stok_awal", 0))
        rows.append(
            StockViewRow(
                item_id=i["id"],
                kode=i.get("kode", ""),
                nama=i.get("nama", ""),
                satuan=i.get("satuan", ""),
                kategori=i.get("kategori", ""),
                stok_awal=awal,
                total_masuk=masuk,
                total_keluar=keluar,
                penyesuaian=adj,
                stok=awal + masuk - keluar + adj,
            )
        )
    return rows


@router.get("/recalc-check", response_model=RecalcReport)
async def recalc_check(_: dict = Depends(require_admin)):
    """Bandingkan stok tersimpan dengan hasil perhitungan dari histori (§AA). Tidak mengubah data."""
    items = await db.items.find({"deleted_at": None}).sort([("kode", 1)]).to_list(50000)
    rows: list[RecalcRow] = []
    for i in items:
        calc = await compute_stock(i["id"], stok_awal=int(i.get("stok_awal", 0)))
        tersimpan = int(i.get("stok", 0))
        if tersimpan != calc["stok"]:
            rows.append(
                RecalcRow(
                    item_id=i["id"],
                    kode=i.get("kode", ""),
                    nama=i.get("nama", ""),
                    satuan=i.get("satuan", ""),
                    stok_tersimpan=tersimpan,
                    stok_hitung=calc["stok"],
                    selisih=calc["stok"] - tersimpan,
                    stok_awal=calc["stok_awal"],
                    total_masuk=calc["total_masuk"],
                    total_keluar=calc["total_keluar"],
                    penyesuaian=calc["penyesuaian"],
                )
            )
    return RecalcReport(total_barang=len(items), tidak_sesuai=len(rows), rows=rows)


@router.post("/recalc-apply", response_model=RecalcReport)
async def recalc_apply(request: Request, user: dict = Depends(require_admin)):
    """Sinkronkan stok tersimpan dengan hasil perhitungan — hanya setelah konfirmasi Administrator."""
    items = await db.items.find({"deleted_at": None}).to_list(50000)
    fixed: list[RecalcRow] = []
    async with await client.start_session() as session:
        async with session.start_transaction():
            for i in items:
                calc = await compute_stock(i["id"], stok_awal=int(i.get("stok_awal", 0)), session=session)
                tersimpan = int(i.get("stok", 0))
                if tersimpan != calc["stok"]:
                    await db.items.update_one(
                        {"id": i["id"]},
                        {"$set": {"stok": calc["stok"], "updated_at": now_utc()}},
                        session=session,
                    )
                    fixed.append(
                        RecalcRow(
                            item_id=i["id"],
                            kode=i.get("kode", ""),
                            nama=i.get("nama", ""),
                            satuan=i.get("satuan", ""),
                            stok_tersimpan=tersimpan,
                            stok_hitung=calc["stok"],
                            selisih=calc["stok"] - tersimpan,
                            stok_awal=calc["stok_awal"],
                            total_masuk=calc["total_masuk"],
                            total_keluar=calc["total_keluar"],
                            penyesuaian=calc["penyesuaian"],
                        )
                    )
    await log_action(
        user,
        "ADJUSTMENT",
        "items",
        detail=f"Hitung ulang stok: {len(fixed)} barang disinkronkan dari {len(items)} barang",
        request=request,
    )
    return RecalcReport(total_barang=len(items), tidak_sesuai=len(fixed), rows=fixed)
