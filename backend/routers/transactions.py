"""Barang masuk / keluar / penyesuaian.

Every mutation runs inside an atomic Mongo transaction (§J): the transaction document and
the recalculated stock commit together, or neither does. Deletes are soft (§I/§U) — the
document stays with status "cancelled" + deleted_at so history survives while its stock
effect disappears from `recalc_stock`.
"""

from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.db import client, db
from lib.helpers import (
    ACTIVE,
    PREFIX,
    compute_stock,
    log_action,
    next_nomor,
    now_utc,
    recalc_stock,
)
from lib.security import get_current_user
from models.inventory import (
    Transaction,
    TransactionBatchIn,
    TransactionIn,
    TransactionPage,
    TransactionUpdate,
)

router = APIRouter(tags=["transaksi"])

MAX_PER_PAGE = 200


def _tx_query(jenis: str, q: str, kategori: str, item_id: str, awal: str, akhir: str) -> dict:
    query: dict = dict(ACTIVE)
    if jenis:
        query["jenis"] = jenis
    if kategori:
        query["kategori"] = kategori
    if item_id:
        query["item_id"] = item_id
    if awal:
        query["tanggal"] = {**query.get("tanggal", {}), "$gte": awal}
    if akhir:
        query["tanggal"] = {**query.get("tanggal", {}), "$lte": akhir}
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [
            {"nomor": rx},
            {"nama_barang": rx},
            {"kode_barang": rx},
            {"penerima": rx},
            {"keterangan": rx},
        ]
    return query


def _validate(tanggal: str, jumlah: int, harga: float, jenis: str) -> None:
    try:
        date_cls.fromisoformat(tanggal)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Tanggal wajib diisi dengan format yang benar")
    if jenis != "penyesuaian" and jumlah < 1:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih besar dari 0")
    if harga < 0:
        raise HTTPException(status_code=400, detail="Harga tidak boleh negatif")


@router.get("/transactions", response_model=list[Transaction])
async def list_transactions(
    jenis: str = "",
    q: str = "",
    kategori: str = "",
    item_id: str = "",
    tanggal_awal: str = "",
    tanggal_akhir: str = "",
    limit: int = 20000,
    _: dict = Depends(get_current_user),
):
    """Full list (dipakai laporan & export). Gunakan /transactions/paged untuk tabel."""
    query = _tx_query(jenis, q, kategori, item_id, tanggal_awal, tanggal_akhir)
    docs = await db.item_transactions.find(query).sort([("tanggal", -1), ("created_at", -1)]).to_list(limit)
    return [Transaction(**d) for d in docs]


@router.get("/transactions/paged", response_model=TransactionPage)
async def list_transactions_paged(
    jenis: str = "",
    q: str = "",
    kategori: str = "",
    item_id: str = "",
    tanggal_awal: str = "",
    tanggal_akhir: str = "",
    page: int = 1,
    per_page: int = 10,
    _: dict = Depends(get_current_user),
):
    """Server-side pagination + search (§AC) — query dijalankan di database, bukan di browser."""
    query = _tx_query(jenis, q, kategori, item_id, tanggal_awal, tanggal_akhir)
    per_page = min(max(per_page, 1), MAX_PER_PAGE)
    page = max(page, 1)
    total = await db.item_transactions.count_documents(query)
    docs = (
        await db.item_transactions.find(query)
        .sort([("tanggal", -1), ("created_at", -1)])
        .skip((page - 1) * per_page)
        .limit(per_page)
        .to_list(per_page)
    )
    agg = await db.item_transactions.aggregate(
        [{"$match": query}, {"$group": {"_id": None, "unit": {"$sum": "$jumlah"}, "nilai": {"$sum": "$total_harga"}}}]
    ).to_list(1)
    return TransactionPage(
        items=[Transaction(**d) for d in docs],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, (total + per_page - 1) // per_page),
        total_unit=int(agg[0]["unit"]) if agg else 0,
        total_nilai=float(agg[0]["nilai"]) if agg else 0.0,
    )


@router.post("/transactions", response_model=Transaction, status_code=201)
async def create_transaction(body: TransactionIn, request: Request, user: dict = Depends(get_current_user)):
    if body.jenis not in {"masuk", "keluar"}:
        raise HTTPException(status_code=400, detail="Jenis transaksi tidak valid")
    _validate(body.tanggal, body.jumlah, body.harga_satuan, body.jenis)

    item = await db.items.find_one({"id": body.item_id})
    if not item or item.get("deleted_at") or item.get("status") == "arsip":
        raise HTTPException(status_code=400, detail="Barang tidak ditemukan atau sudah diarsipkan")

    async with await client.start_session() as session:
        try:
            async with session.start_transaction():
                if body.jenis == "keluar":
                    tersedia = (await compute_stock(item["id"], session=session))["stok"]
                    if body.jumlah > tersedia:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stok tidak mencukupi. Stok tersedia: {tersedia} {item.get('satuan', '')}.",
                        )
                nomor = await next_nomor("item_transactions", PREFIX[body.jenis], int(body.tanggal[:4]), session=session)
                trans = Transaction(
                    nomor=nomor,
                    jenis=body.jenis,
                    tanggal=body.tanggal,
                    item_id=item["id"],
                    kode_barang=item.get("kode", ""),
                    nama_barang=item.get("nama", ""),
                    kategori=item.get("kategori", ""),
                    satuan=item.get("satuan", ""),
                    jumlah=body.jumlah,
                    harga_satuan=body.harga_satuan,
                    total_harga=round(body.jumlah * body.harga_satuan, 2),
                    sumber_dana=body.sumber_dana.strip(),
                    nomor_dokumen=body.nomor_dokumen.strip(),
                    tujuan=body.tujuan.strip(),
                    penerima=body.penerima.strip(),
                    keperluan=body.keperluan.strip(),
                    lokasi=body.lokasi.strip() or item.get("lokasi", ""),
                    kondisi=body.kondisi.strip() or item.get("kondisi", "Baik"),
                    keterangan=body.keterangan.strip(),
                    user_id=user["id"],
                    user_name=user["nama"],
                )
                doc = trans.model_dump()
                await db.item_transactions.insert_one(doc, session=session)
                await recalc_stock(item["id"], session=session)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Data gagal disimpan. Silakan coba lagi.")

    await log_action(
        user,
        "CREATE",
        "stock_transactions",
        doc["id"],
        f"{doc['nomor']}: {item['nama']} x{body.jumlah} {item.get('satuan', '')}",
        new_data=doc,
        request=request,
    )
    return Transaction(**doc)


@router.post("/transactions/batch", response_model=list[Transaction], status_code=201)
async def create_transaction_batch(
    body: TransactionBatchIn, request: Request, user: dict = Depends(get_current_user)
):
    """Satu transaksi (satu nomor) untuk beberapa jenis barang sekaligus (§F).

    Semua baris ditulis dalam satu transaksi database: bila satu barang stoknya tidak
    mencukupi, seluruh transaksi dibatalkan (tidak ada data setengah tersimpan).
    """
    if body.jenis not in {"masuk", "keluar"}:
        raise HTTPException(status_code=400, detail="Jenis transaksi tidak valid")
    if not body.lines:
        raise HTTPException(status_code=400, detail="Tambahkan minimal satu barang")

    # Gabungkan baris duplikat agar validasi stok memakai total per barang.
    merged: dict[str, dict] = {}
    for line in body.lines:
        _validate(body.tanggal, line.jumlah, line.harga_satuan, body.jenis)
        cur = merged.setdefault(line.item_id, {"jumlah": 0, "harga_satuan": line.harga_satuan, "keterangan": ""})
        cur["jumlah"] += line.jumlah
        cur["harga_satuan"] = line.harga_satuan
        cur["keterangan"] = line.keterangan.strip() or cur["keterangan"]

    items: dict[str, dict] = {}
    for item_id in merged:
        item = await db.items.find_one({"id": item_id})
        if not item or item.get("deleted_at") or item.get("status") == "arsip":
            raise HTTPException(status_code=400, detail="Barang tidak ditemukan atau sudah diarsipkan")
        items[item_id] = item

    docs: list[dict] = []
    async with await client.start_session() as session:
        try:
            async with session.start_transaction():
                nomor = await next_nomor(
                    "item_transactions", PREFIX[body.jenis], int(body.tanggal[:4]), session=session
                )
                for item_id, line in merged.items():
                    item = items[item_id]
                    if body.jenis == "keluar":
                        tersedia = (await compute_stock(item_id, session=session))["stok"]
                        if line["jumlah"] > tersedia:
                            raise HTTPException(
                                status_code=400,
                                detail=(
                                    f"Stok {item.get('nama', '')} tidak mencukupi. "
                                    f"Stok tersedia: {tersedia} {item.get('satuan', '')}."
                                ),
                            )
                    trans = Transaction(
                        nomor=nomor,
                        jenis=body.jenis,
                        tanggal=body.tanggal,
                        item_id=item_id,
                        kode_barang=item.get("kode", ""),
                        nama_barang=item.get("nama", ""),
                        kategori=item.get("kategori", ""),
                        satuan=item.get("satuan", ""),
                        jumlah=line["jumlah"],
                        harga_satuan=line["harga_satuan"],
                        total_harga=round(line["jumlah"] * line["harga_satuan"], 2),
                        sumber_dana=body.sumber_dana.strip(),
                        nomor_dokumen=body.nomor_dokumen.strip(),
                        tujuan=body.tujuan.strip(),
                        penerima=body.penerima.strip(),
                        keperluan=body.keperluan.strip(),
                        lokasi=body.lokasi.strip() or item.get("lokasi", ""),
                        kondisi=body.kondisi.strip() or item.get("kondisi", "Baik"),
                        keterangan=line["keterangan"] or body.keterangan.strip(),
                        user_id=user["id"],
                        user_name=user["nama"],
                    )
                    doc = trans.model_dump()
                    await db.item_transactions.insert_one(doc, session=session)
                    await recalc_stock(item_id, session=session)
                    docs.append(doc)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Data gagal disimpan. Silakan coba lagi.")

    await log_action(
        user,
        "CREATE",
        "stock_transactions",
        docs[0]["id"],
        f"{docs[0]['nomor']}: {len(docs)} jenis barang ({', '.join(d['nama_barang'] for d in docs)})",
        new_data=docs[0],
        request=request,
    )
    return [Transaction(**d) for d in docs]


@router.put("/transactions/{trans_id}", response_model=Transaction)
async def update_transaction(
    trans_id: str, body: TransactionUpdate, request: Request, user: dict = Depends(get_current_user)
):
    """Edit membatalkan pengaruh transaksi lama lalu menerapkan yang baru (§G/§H) —
    stok dihitung ulang dari histori, bukan ditambah/dikurangi dari angka lama."""
    trans = await db.item_transactions.find_one({"id": trans_id, **ACTIVE})
    if not trans:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    item = await db.items.find_one({"id": trans["item_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Barang transaksi tidak ditemukan")

    updates = body.model_dump(exclude_none=True)
    tanggal = updates.get("tanggal", trans["tanggal"])
    jumlah = int(updates.get("jumlah", trans["jumlah"]))
    harga = float(updates.get("harga_satuan", trans.get("harga_satuan", 0)))
    _validate(tanggal, jumlah, harga, trans["jenis"])
    updates["total_harga"] = round(jumlah * harga, 2)
    updates["updated_at"] = now_utc()
    old = dict(trans)

    async with await client.start_session() as session:
        try:
            async with session.start_transaction():
                await db.item_transactions.update_one({"id": trans_id}, {"$set": updates}, session=session)
                calc = await compute_stock(item["id"], session=session)
                if calc["stok"] < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Perubahan ditolak karena membuat stok {item['nama']} menjadi negatif "
                            f"({calc['stok']}). Sesuaikan jumlah atau catat barang masuk terlebih dahulu."
                        ),
                    )
                await recalc_stock(item["id"], session=session)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Data gagal disimpan. Silakan coba lagi.")

    fresh = await db.item_transactions.find_one({"id": trans_id})
    await log_action(
        user,
        "UPDATE",
        "stock_transactions",
        trans_id,
        f"{trans['nomor']}: jumlah {old['jumlah']} -> {jumlah}",
        old_data=old,
        new_data=fresh,
        request=request,
    )
    return Transaction(**fresh)


@router.delete("/transactions/{trans_id}")
async def delete_transaction(trans_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Soft delete (§I/§U): status -> cancelled + deleted_at, histori tetap tersimpan."""
    trans = await db.item_transactions.find_one({"id": trans_id, **ACTIVE})
    if not trans:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    item = await db.items.find_one({"id": trans["item_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Barang transaksi tidak ditemukan")

    async with await client.start_session() as session:
        try:
            async with session.start_transaction():
                await db.item_transactions.update_one(
                    {"id": trans_id},
                    {"$set": {"status": "cancelled", "deleted_at": now_utc(), "updated_at": now_utc()}},
                    session=session,
                )
                calc = await compute_stock(item["id"], session=session)
                if calc["stok"] < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Tidak dapat menghapus: stok {item['nama']} akan menjadi negatif ({calc['stok']}). "
                            "Barang sudah terpakai — hapus transaksi keluar terkait atau gunakan Stok Opname."
                        ),
                    )
                await recalc_stock(item["id"], session=session)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Data gagal dihapus. Silakan coba lagi.")

    await log_action(
        user,
        "DELETE",
        "stock_transactions",
        trans_id,
        f"{trans['nomor']}: {trans['nama_barang']} x{trans['jumlah']} (dibatalkan, histori tetap tersimpan)",
        old_data=trans,
        request=request,
    )
    return {"message": f"Transaksi {trans['nomor']} dibatalkan dan stok dihitung ulang"}
