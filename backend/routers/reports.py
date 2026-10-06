"""Report-specific aggregations (mutasi barang)."""

from fastapi import APIRouter, Depends

from lib.db import db
from lib.security import get_current_user
from models.inventory import MutasiRow

router = APIRouter(prefix="/reports", tags=["laporan"])


@router.get("/mutasi", response_model=list[MutasiRow])
async def mutasi(awal: str = "", akhir: str = "", _: dict = Depends(get_current_user)):
    items = await db.items.find({"deleted_at": None}).sort([("kode", 1)]).to_list(50000)
    match: dict = {"status": "active"}
    if awal:
        match["tanggal"] = {**match.get("tanggal", {}), "$gte": awal}
    if akhir:
        match["tanggal"] = {**match.get("tanggal", {}), "$lte": akhir}
    agg = await db.item_transactions.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": {"item": "$item_id", "jenis": "$jenis"}, "total": {"$sum": "$jumlah"}}},
        ]
    ).to_list(200000)
    per: dict[str, dict[str, int]] = {}
    for a in agg:
        per.setdefault(a["_id"]["item"], {})[a["_id"]["jenis"]] = int(a["total"])
    rows: list[MutasiRow] = []
    for i in items:
        p = per.get(i["id"], {})
        masuk, keluar, adj = p.get("masuk", 0), p.get("keluar", 0), p.get("penyesuaian", 0)
        rows.append(
            MutasiRow(
                item_id=i["id"],
                kode=i.get("kode", ""),
                nama=i.get("nama", ""),
                kategori=i.get("kategori", ""),
                satuan=i.get("satuan", ""),
                lokasi=i.get("lokasi", ""),
                stok_awal=int(i.get("stok_awal", 0)),
                masuk=masuk,
                keluar=keluar,
                penyesuaian=adj,
                stok_akhir=int(i.get("stok", 0)),
            )
        )
    return rows
