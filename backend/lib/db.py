"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

import os
# Kode ini otomatis membaca variabel secara langsung dari Railway tanpa perlu library luar!

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("username", ASCENDING)], name="username", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "items": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("kode", ASCENDING)], name="kode", unique=True),
        IndexModel([("nama", ASCENDING)], name="nama"),
        IndexModel([("jenis", ASCENDING), ("kategori", ASCENDING)], name="jenis_kategori"),
        IndexModel([("deleted_at", ASCENDING), ("nama", ASCENDING)], name="deleted_nama"),
        IndexModel([("deleted_at", ASCENDING), ("kode", ASCENDING)], name="deleted_kode"),
        IndexModel([("lokasi", ASCENDING)], name="lokasi"),
        IndexModel([("tahun", ASCENDING)], name="tahun"),
        IndexModel([("kondisi", ASCENDING)], name="kondisi"),
        IndexModel([("stok", ASCENDING)], name="stok"),
    ],
    "item_transactions": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        # Satu nomor transaksi boleh memuat beberapa barang (satu baris per barang),
        # sehingga keunikan berlaku per kombinasi nomor + barang.
        IndexModel([("nomor", ASCENDING), ("item_id", ASCENDING)], name="nomor_item", unique=True),
        IndexModel([("nomor", ASCENDING)], name="nomor"),
        IndexModel([("item_id", ASCENDING), ("tanggal", ASCENDING), ("created_at", ASCENDING)], name="item_tanggal_created"),
        IndexModel([("status", ASCENDING), ("item_id", ASCENDING)], name="status_item"),
        IndexModel([("status", ASCENDING), ("jenis", ASCENDING), ("tanggal", DESCENDING)], name="status_jenis_tanggal"),
        IndexModel([("tanggal", DESCENDING)], name="tanggal_desc"),
        IndexModel([("kategori", ASCENDING)], name="kategori"),
        IndexModel([("deleted_at", ASCENDING)], name="deleted_at"),
    ],
    "categories": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nama", ASCENDING)], name="nama", unique=True),
    ],
    "locations": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nama", ASCENDING)], name="nama", unique=True),
    ],
    "stock_opnames": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nomor", ASCENDING)], name="nomor", unique=True),
        IndexModel([("tanggal", DESCENDING)], name="tanggal_desc"),
    ],
    "audit_logs": [IndexModel([("waktu", DESCENDING)], name="waktu_desc")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
