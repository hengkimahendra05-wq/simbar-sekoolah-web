"""Excel import: parse .xlsx/.xls/.csv -> validate -> preview -> commit (§O/§P).

Data hanya tersimpan setelah pengguna menekan Import. Mode duplikat:
  tambah  = kode barang sudah ada -> baris DITOLAK (tidak membuat kode ganda)
  update  = perbarui barang berdasarkan item_code (tanpa membuat record baru)
  lewati  = baris duplikat dilewati
"""

from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from lib.db import db
from lib.helpers import log_action, next_kode, now_utc, recalc_stock
from lib.security import get_current_user
from models.inventory import Item
from models.ops import ImportCommit, ImportPreview, ImportResult, ImportRow

router = APIRouter(prefix="/import", tags=["import"])

ALIASES = {
    "item_code": "kode", "kode barang": "kode", "kode": "kode",
    "item_name": "nama", "nama barang": "nama", "nama": "nama",
    "category": "kategori", "kategori": "kategori",
    "item_type": "jenis", "jenis barang": "jenis", "jenis": "jenis",
    "brand": "merk", "merk": "merk", "merek": "merk",
    "model": "tipe_model", "tipe": "tipe_model", "tipe/model": "tipe_model",
    "specification": "spesifikasi", "spesifikasi": "spesifikasi",
    "unit": "satuan", "satuan": "satuan",
    "acquisition_year": "tahun", "tahun perolehan": "tahun", "tahun": "tahun",
    "funding_source": "sumber_dana", "sumber dana": "sumber_dana",
    "unit_price": "harga_satuan", "harga satuan (rp)": "harga_satuan", "harga satuan": "harga_satuan",
    "harga (rp)": "harga_satuan", "harga": "harga_satuan",
    "initial_stock": "stok", "jumlah/stok": "stok", "jumlah stok": "stok", "stok awal": "stok",
    "jumlah": "stok", "stok": "stok",
    "stok minimum": "stok_minimum", "minimal stok": "stok_minimum",
    "location": "lokasi", "lokasi/ruang": "lokasi", "lokasi ruang": "lokasi", "lokasi": "lokasi", "ruang": "lokasi",
    "condition": "kondisi", "kondisi": "kondisi",
    "serial_number": "nomor_seri", "nomor seri": "nomor_seri",
    "nup": "nup",
    "description": "keterangan", "keterangan": "keterangan",
}

KATEGORI_MAP = {
    "atk": "ATK",
    "alat kebersihan": "Alat Kebersihan", "kebersihan": "Alat Kebersihan",
    "meubelair": "Meubelair", "mebelair": "Meubelair", "mebel": "Meubelair",
    "alat elektronik": "Alat Elektronik", "elektronik": "Alat Elektronik",
    "peralatan bengkel": "Peralatan Bengkel", "bengkel": "Peralatan Bengkel",
    "peralatan laboratorium": "Peralatan Laboratorium", "laboratorium": "Peralatan Laboratorium", "lab": "Peralatan Laboratorium",
    "peralatan olahraga": "Peralatan Olahraga", "olahraga": "Peralatan Olahraga",
    "lainnya": "Lainnya", "lain": "Lainnya", "lain-lain": "Lainnya",
}


def _kondisi(raw: str) -> str:
    v = raw.strip().lower()
    if "berat" in v:
        return "Rusak Berat"
    if "ringan" in v:
        return "Rusak Ringan"
    return "Baik"


def _jenis(raw: str) -> str:
    v = raw.strip().lower()
    return "inventaris" if ("invent" in v or "aset" in v or "asset" in v) else "persediaan"


def _num(raw: object) -> int | None:
    v = str(raw or "").strip().replace(".", "").replace(",", "")
    if v == "":
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _read_df(name: str, data: bytes) -> pd.DataFrame:
    buf = BytesIO(data)
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(buf, sep=None, engine="python", dtype=str, keep_default_na=False)
        elif name.endswith(".xls"):
            df = pd.read_excel(buf, engine="xlrd", dtype=str, keep_default_na=False)
        elif name.endswith(".xlsx"):
            df = pd.read_excel(buf, engine="openpyxl", dtype=str, keep_default_na=False)
        else:
            raise HTTPException(status_code=400, detail="Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="File tidak dapat dibaca. Pastikan file Excel/CSV valid.")
    return df.fillna("")


@router.post("/preview", response_model=ImportPreview)
async def preview(file: UploadFile = File(...), _: dict = Depends(get_current_user)):
    name = (file.filename or "").lower()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File kosong atau tidak terbaca")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 5 MB")
    df = _read_df(name, data)
    if df.empty:
        raise HTTPException(status_code=400, detail="File tidak berisi data")

    # LANGKAH 2 — validasi header
    mapped: dict = {}
    for col in list(df.columns):
        key = ALIASES.get(str(col).strip().lower())
        if key and key not in mapped.values():
            mapped[col] = key
    if "nama" not in mapped.values():
        raise HTTPException(
            status_code=400,
            detail="Format file tidak sesuai dengan template. Kolom 'Nama Barang' (item_name) tidak ditemukan.",
        )
    df = df.rename(columns=mapped)
    records = df.to_dict("records")

    existing = await db.items.find({}, {"id": 1, "kode": 1, "nama": 1, "kategori": 1}).to_list(100000)
    by_kode = {e["kode"]: e for e in existing if e.get("kode") and e.get("id")}
    by_nama = {
        (e.get("nama", "").strip().lower(), e.get("kategori", "")): e for e in existing if e.get("id")
    }
    seen_kode: set[str] = set()

    rows: list[ImportRow] = []
    for i, rec in enumerate(records):
        row = ImportRow(baris=i + 2)
        row.nama = str(rec.get("nama", "")).strip()
        row.kode = str(rec.get("kode", "")).strip().upper()
        err = ""
        if not row.nama:
            err = "Nama barang kosong"
        kategori_raw = str(rec.get("kategori", "")).strip()
        if not err:
            if kategori_raw:
                norm = KATEGORI_MAP.get(kategori_raw.lower())
                if norm:
                    row.kategori = norm
                else:
                    err = f"Kategori '{kategori_raw}' tidak ditemukan"
            else:
                row.kategori = "Lainnya"
        if not err:
            row.jenis = _jenis(str(rec.get("jenis", "")))
            row.kondisi = _kondisi(str(rec.get("kondisi", "")))
            row.satuan = str(rec.get("satuan", "")).strip() or "Buah"
            row.merk = str(rec.get("merk", "")).strip()
            row.tipe_model = str(rec.get("tipe_model", "")).strip()
            row.spesifikasi = str(rec.get("spesifikasi", "")).strip()
            row.sumber_dana = str(rec.get("sumber_dana", "")).strip()
            row.nomor_seri = str(rec.get("nomor_seri", "")).strip()
            row.nup = str(rec.get("nup", "")).strip()
            row.lokasi = str(rec.get("lokasi", "")).strip()
            row.keterangan = str(rec.get("keterangan", "")).strip()
            tahun_raw = str(rec.get("tahun", "")).strip()
            if tahun_raw:
                th = _num(tahun_raw)
                if th is None or th < 1900 or th > 2100:
                    err = f"Tahun '{tahun_raw}' tidak valid"
                else:
                    row.tahun = th
        if not err:
            stok_raw = str(rec.get("stok", "")).strip()
            if stok_raw:
                stok = _num(stok_raw)
                if stok is None or stok < 0:
                    err = f"Stok '{stok_raw}' tidak valid"
                else:
                    row.stok = stok
        if not err:
            harga_raw = str(rec.get("harga_satuan", "")).strip()
            if harga_raw:
                harga = _num(harga_raw)
                if harga is None or harga < 0:
                    err = f"Harga '{harga_raw}' tidak valid"
                else:
                    row.harga_satuan = float(harga)
            sm = _num(str(rec.get("stok_minimum", "")))
            row.stok_minimum = sm if sm is not None and sm >= 0 else 5

        # LANGKAH 4/5 — tandai error & duplikat
        if err:
            row.status, row.pesan = "error", err
        elif row.kode and row.kode in seen_kode:
            row.status = "error"
            row.pesan = f"Kode {row.kode} muncul lebih dari sekali di dalam file"
        elif row.kode and row.kode in by_kode:
            row.status = "duplikat"
            row.pesan = f"Kode barang {row.kode} sudah ada ('{by_kode[row.kode]['nama']}')"
            row.existing_id = by_kode[row.kode]["id"]
        elif (row.nama.lower(), row.kategori) in by_nama:
            hit = by_nama[(row.nama.lower(), row.kategori)]
            row.status = "duplikat"
            row.pesan = f"'{row.nama}' kategori {row.kategori} sudah ada (kode {hit.get('kode', '')})"
            row.existing_id = hit["id"]
        else:
            row.status = "valid"
        if row.kode:
            seen_kode.add(row.kode)
        rows.append(row)

    return ImportPreview(
        total=len(rows),
        valid=sum(1 for r in rows if r.status == "valid"),
        duplikat=sum(1 for r in rows if r.status == "duplikat"),
        error=sum(1 for r in rows if r.status == "error"),
        rows=rows,
    )


@router.post("/commit", response_model=ImportResult)
async def commit(body: ImportCommit, request: Request, user: dict = Depends(get_current_user)):
    if body.mode not in {"tambah", "update", "lewati"}:
        raise HTTPException(status_code=400, detail="Mode import tidak valid")
    res = ImportResult()
    pesan: list[str] = []
    for row in body.rows:
        if row.status == "error":
            res.gagal += 1
            continue
        data = {
            "nama": row.nama,
            "jenis": row.jenis,
            "kategori": row.kategori or "Lainnya",
            "merk": row.merk,
            "tipe_model": row.tipe_model,
            "spesifikasi": row.spesifikasi,
            "satuan": row.satuan or "Buah",
            "tahun": row.tahun,
            "sumber_dana": row.sumber_dana,
            "lokasi": row.lokasi,
            "kondisi": row.kondisi,
            "nomor_seri": row.nomor_seri,
            "nup": row.nup,
            "stok_awal": row.stok,
            "stok_minimum": row.stok_minimum,
            "harga_satuan": row.harga_satuan,
            "keterangan": row.keterangan,
        }
        if row.status == "valid":
            kode = row.kode or await next_kode()
            if await db.items.find_one({"kode": kode}):
                res.gagal += 1
                pesan.append(f"Baris {row.baris}: kode {kode} sudah digunakan")
                continue
            item = Item(**data, kode=kode, created_by=user["id"], updated_by=user["id"])
            item.stok = item.stok_awal
            await db.items.insert_one(item.model_dump())
            res.berhasil += 1
            continue

        # baris duplikat -> tergantung mode
        if body.mode == "lewati":
            res.dilewati += 1
        elif body.mode == "tambah":
            # §P MODE 1: kode barang sudah ada -> tolak (jangan buat kode ganda)
            if row.kode:
                res.gagal += 1
                pesan.append(f"Baris {row.baris}: kode {row.kode} sudah ada, data ditolak")
            else:
                item = Item(**data, kode=await next_kode(), created_by=user["id"], updated_by=user["id"])
                item.stok = item.stok_awal
                await db.items.insert_one(item.model_dump())
                res.berhasil += 1
        else:  # update berdasarkan item_code
            target = row.existing_id
            if not target and row.kode:
                hit = await db.items.find_one({"kode": row.kode}, {"id": 1})
                target = hit["id"] if hit else ""
            if not target:
                res.gagal += 1
                continue
            await db.items.update_one(
                {"id": target}, {"$set": {**data, "updated_at": now_utc(), "updated_by": user["id"]}}
            )
            await recalc_stock(target)
            res.diperbarui += 1
    res.pesan = pesan[:50]
    await log_action(
        user,
        "IMPORT",
        "items",
        detail=(
            f"mode {body.mode}: {res.berhasil} berhasil, {res.diperbarui} diperbarui, "
            f"{res.dilewati} dilewati, {res.gagal} gagal"
        ),
        request=request,
    )
    return res
