"""Stok opname: compare system stock vs physical count; stock changes only on explicit adjustment."""

from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.db import client, db
from lib.dates import today_iso
from lib.helpers import (
    PREFIX,
    compute_stock,
    log_action,
    next_nomor,
    now_utc,
    recalc_stock,
)
from lib.security import get_current_user
from models.base import new_id
from models.inventory import Transaction
from models.ops import Opname, OpnameIn, OpnameItemIn, OpnameUpdate

router = APIRouter(tags=["stok-opname"])


@router.get("/opnames", response_model=list[Opname])
async def list_opnames(_: dict = Depends(get_current_user)):
    docs = await db.stock_opnames.find().sort([("tanggal", -1), ("created_at", -1)]).to_list(5000)
    return [Opname(**d) for d in docs]


@router.post("/opnames", response_model=Opname, status_code=201)
async def create_opname(body: OpnameIn, request: Request, user: dict = Depends(get_current_user)):
    try:
        date_cls.fromisoformat(body.tanggal)
    except ValueError:
        raise HTTPException(status_code=400, detail="Tanggal tidak valid")
    if not body.items:
        raise HTTPException(status_code=400, detail="Pilih minimal satu barang untuk diopname")
    details = []
    for entry in body.items:
        item = await db.items.find_one({"id": entry.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="Ada barang yang tidak ditemukan")
        if entry.stok_fisik < 0:
            raise HTTPException(status_code=400, detail=f"Stok fisik {item['nama']} tidak boleh negatif")
        sistem = int(item.get("stok", 0))
        details.append(
            {
                "item_id": item["id"],
                "kode": item.get("kode", ""),
                "nama": item.get("nama", ""),
                "satuan": item.get("satuan", ""),
                "stok_sistem": sistem,
                "stok_fisik": entry.stok_fisik,
                "selisih": entry.stok_fisik - sistem,
                "keterangan": entry.keterangan.strip(),
            }
        )
    nomor = await next_nomor("stock_opnames", "SO", int(body.tanggal[:4]))
    doc = {
        "id": new_id(),
        "nomor": nomor,
        "tanggal": body.tanggal,
        "lokasi": body.lokasi.strip(),
        "kategori": body.kategori.strip(),
        "petugas": body.petugas.strip() or user["nama"],
        "status": "draft",
        "details": details,
        "user_id": user["id"],
        "user_name": user["nama"],
        "created_at": now_utc(),
    }
    await db.stock_opnames.insert_one(doc)
    await log_action(user, "CREATE", "stock_opnames", doc["id"], f"{nomor}: {len(details)} barang diperiksa", new_data=doc, request=request)
    return Opname(**doc)


@router.put("/opnames/{opname_id}", response_model=Opname)
async def update_opname(opname_id: str, body: OpnameUpdate, request: Request, user: dict = Depends(get_current_user)):
    doc = await db.stock_opnames.find_one({"id": opname_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Stok opname tidak ditemukan")
    if doc.get("status") != "draft":
        raise HTTPException(
            status_code=400,
            detail="Opname sudah disesuaikan dan dikunci agar histori stok tetap konsisten",
        )
    details = []
    for d in body.details:
        details.append(
            {
                "item_id": d.item_id,
                "kode": d.kode,
                "nama": d.nama,
                "satuan": d.satuan,
                "stok_sistem": d.stok_sistem,
                "stok_fisik": d.stok_fisik,
                "selisih": d.stok_fisik - d.stok_sistem,
                "keterangan": d.keterangan.strip(),
            }
        )
    updates = {
        "tanggal": body.tanggal or doc["tanggal"],
        "lokasi": body.lokasi.strip(),
        "kategori": body.kategori.strip(),
        "petugas": body.petugas.strip() or doc.get("petugas", ""),
        "details": details,
    }
    await db.stock_opnames.update_one({"id": opname_id}, {"$set": updates})
    await log_action(user, "UPDATE", "stock_opnames", opname_id, f"{doc['nomor']}", old_data=doc, request=request)
    fresh = await db.stock_opnames.find_one({"id": opname_id})
    return Opname(**fresh)


@router.delete("/opnames/{opname_id}")
async def delete_opname(opname_id: str, request: Request, user: dict = Depends(get_current_user)):
    doc = await db.stock_opnames.find_one({"id": opname_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Stok opname tidak ditemukan")
    await db.stock_opnames.delete_one({"id": opname_id})
    await log_action(user, "DELETE", "stock_opnames", opname_id, f"{doc['nomor']}", old_data=doc, request=request)
    return {"message": f"Stok opname {doc['nomor']} dihapus"}


@router.post("/opnames/{opname_id}/adjust")
async def adjust_opname(opname_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Tombol 'Sesuaikan Stok' (§M): buat transaksi ADJUSTMENT (ADJ-YYYY-nnnn) sebesar selisih.

    Seluruh penyesuaian berjalan dalam satu transaksi database — bila satu barang gagal,
    seluruh perubahan di-rollback sehingga tidak ada penyesuaian yang tersimpan separuh.
    """
    doc = await db.stock_opnames.find_one({"id": opname_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Stok opname tidak ditemukan")
    if doc.get("status") == "disesuaikan":
        raise HTTPException(status_code=400, detail="Stok untuk opname ini sudah pernah disesuaikan")

    changed = 0
    nomor_list: list[str] = []
    async with await client.start_session() as session:
        try:
            async with session.start_transaction():
                for d in doc.get("details", []):
                    selisih = int(d.get("selisih", 0))
                    if selisih == 0:
                        continue
                    item = await db.items.find_one({"id": d["item_id"]}, session=session)
                    if not item:
                        raise HTTPException(status_code=400, detail=f"Barang {d.get('nama', '')} tidak ditemukan")
                    nomor = await next_nomor("item_transactions", PREFIX["penyesuaian"], int(today_iso()[:4]), session=session)
                    trans = Transaction(
                        nomor=nomor,
                        jenis="penyesuaian",
                        tanggal=doc.get("tanggal") or today_iso(),
                        item_id=item["id"],
                        kode_barang=item.get("kode", ""),
                        nama_barang=item.get("nama", ""),
                        kategori=item.get("kategori", ""),
                        satuan=item.get("satuan", ""),
                        jumlah=selisih,  # bertanda: +lebih / -kurang
                        harga_satuan=float(item.get("harga_satuan", 0)),
                        total_harga=abs(selisih) * float(item.get("harga_satuan", 0)),
                        lokasi=item.get("lokasi", ""),
                        kondisi=item.get("kondisi", "Baik"),
                        penerima=doc.get("petugas", "") or user["nama"],
                        keterangan=(
                            f"Penyesuaian stok opname {doc['nomor']} "
                            f"(sistem: {d.get('stok_sistem', 0)}, fisik: {d.get('stok_fisik', 0)})"
                        ),
                        opname_id=opname_id,
                        user_id=user["id"],
                        user_name=user["nama"],
                    )
                    tdoc = trans.model_dump()
                    await db.item_transactions.insert_one(tdoc, session=session)
                    stok_baru = await recalc_stock(item["id"], session=session)
                    if stok_baru < 0:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stok {item['nama']} tidak dapat disesuaikan karena menjadi negatif ({stok_baru}).",
                        )
                    nomor_list.append(nomor)
                    changed += 1
                await db.stock_opnames.update_one(
                    {"id": opname_id},
                    {"$set": {"status": "disesuaikan", "adjusted_at": now_utc()}},
                    session=session,
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Penyesuaian stok gagal. Seluruh perubahan dibatalkan.")

    await log_action(
        user,
        "ADJUSTMENT",
        "stock_opnames",
        opname_id,
        f"{doc['nomor']}: {changed} barang disesuaikan ({', '.join(nomor_list)})",
        request=request,
    )
    return {
        "message": f"Stok {changed} barang berhasil disesuaikan berdasarkan hasil opname {doc['nomor']}",
        "disesuaikan": changed,
        "nomor_penyesuaian": nomor_list,
    }
