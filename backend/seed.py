import subprocess
import sys
try:
    import motor
except ImportError:
    subprocess.check_call([sys.executable, "-m", "ensurepip"])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "motor", "pymongo"])

"""Seed data contoh SIMBARA SEKOLAH. Jalankan: cd /app/backend && python seed.py
Gunakan FORCE_SEED=1 untuk mengganti semua data (drop + seed ulang).
"""

import asyncio
import os
from datetime import date, timedelta

from lib.db import db, ensure_indexes
from lib.helpers import next_kode, next_nomor, recalc_stock
from lib.security import hash_password
from models.base import new_id, now_utc
from models.inventory import Item

SEED_USERS = [
    {
        "nama": "Administrator Sekolah", "username": "admin", "email": "admin@smpn1teladan.sch.id",
        "role": "admin", "nip": "196805121992032004", "password": "admin123",
    },
    {
        "nama": "Budi Santoso, S.Pd.", "username": "pengurus", "email": "budi@smpn1teladan.sch.id",
        "role": "pengurus", "nip": "198703152010011005", "password": "pengurus123",
    },
]

SEED_CATEGORIES = [
    ("ATK", "KAT-01"), ("Alat Kebersihan", "KAT-02"), ("Meubelair", "KAT-03"),
    ("Alat Elektronik", "KAT-04"), ("Peralatan Bengkel", "KAT-05"),
    ("Peralatan Laboratorium", "KAT-06"), ("Peralatan Olahraga", "KAT-07"), ("Lainnya", "KAT-08"),
]

SEED_LOCATIONS = [
    ("Gudang Utama", "GUD-01", "Gedung A"), ("Ruang TU", "TU-01", "Gedung A"),
    ("Ruang Kepala Sekolah", "KS-01", "Gedung A"), ("Ruang Guru", "RG-01", "Gedung A"),
    ("Ruang Kelas", "RK-01", "Gedung B"), ("Lab Komputer", "LAB-01", "Gedung B"),
    ("Perpustakaan", "PERP-01", "Gedung B"), ("UKS", "UKS-01", "Gedung A"),
]

SEED_PROFILE = {
    "nama_sekolah": "SMP NEGERI 1 TELADAN", "npsn": "20219742", "alamat": "Jl. Pendidikan No. 45",
    "kelurahan": "Sukamaju", "kecamatan": "Cibinong", "kota": "Kabupaten Bogor", "provinsi": "Jawa Barat",
    "kode_pos": "16915", "telepon": "(0251) 8654321", "email": "smpn1teladan@gmail.com",
    "website": "smpn1teladan.sch.id", "kepala_sekolah": "Dra. Hj. Ratna Wijaya, M.Pd.",
    "nip_kepala": "196805121992032004", "pengurus_barang": "Budi Santoso, S.Pd.",
    "nip_pengurus": "198703152010011005", "logo": "",
}

# (nama, jenis, kategori, satuan, tahun, lokasi, kondisi, stok_awal, stok_minimum, harga, keterangan)
SEED_ITEMS = [
    ("Kertas A4 Sinar Dunia", "persediaan", "ATK", "Rim", 2024, "Gudang Utama", "Baik", 200, 20, 55000, "Kertas administrasi & ujian"),
    ("Pulpen Standard AE7", "persediaan", "ATK", "Pcs", 2025, "Gudang Utama", "Baik", 150, 25, 3000, ""),
    ("Pensil 2B", "persediaan", "ATK", "Pcs", 2025, "Gudang Utama", "Baik", 120, 20, 5000, ""),
    ("Map Folder Kancing", "persediaan", "ATK", "Buah", 2024, "Ruang TU", "Baik", 60, 10, 12000, ""),
    ("Tinta Printer Epson 003 Hitam", "persediaan", "ATK", "Botol", 2025, "Ruang TU", "Baik", 10, 5, 95000, "Untuk printer administrasi"),
    ("Sapu Ijuk", "persediaan", "Alat Kebersihan", "Buah", 2025, "Gudang Utama", "Baik", 15, 5, 35000, ""),
    ("Pel Lantai Putar", "persediaan", "Alat Kebersihan", "Buah", 2025, "Gudang Utama", "Baik", 8, 4, 85000, ""),
    ("Ember 20 Liter", "persediaan", "Alat Kebersihan", "Buah", 2024, "Gudang Utama", "Baik", 10, 3, 40000, ""),
    ("Tempat Sampah", "persediaan", "Alat Kebersihan", "Buah", 2023, "Gudang Utama", "Baik", 4, 5, 65000, "Stok kosong - usul pengadaan"),
    ("Cairan Pembersih Lantai", "persediaan", "Alat Kebersihan", "Botol", 2025, "Gudang Utama", "Baik", 6, 8, 25000, ""),
    ("Meja Guru Kayun", "inventaris", "Meubelair", "Buah", 2021, "Ruang Guru", "Baik", 12, 2, 850000, ""),
    ("Kursi Guru", "inventaris", "Meubelair", "Buah", 2021, "Ruang Guru", "Baik", 12, 2, 450000, ""),
    ("Meja Siswa", "inventaris", "Meubelair", "Buah", 2020, "Ruang Kelas", "Baik", 120, 10, 350000, "Distribusi kelas 1-6"),
    ("Kursi Siswa", "inventaris", "Meubelair", "Buah", 2020, "Ruang Kelas", "Rusak Ringan", 120, 10, 200000, "Sebagian rusak ringan"),
    ("Lemari Arsip 4 Pintu", "inventaris", "Meubelair", "Buah", 2019, "Ruang TU", "Baik", 6, 1, 1800000, ""),
    ("Kursi Plastik Siswa", "inventaris", "Meubelair", "Buah", 2018, "Gudang Utama", "Rusak Berat", 20, 5, 120000, "Usulan penghapusan (rusak berat)"),
    ("Laptop Asus", "inventaris", "Alat Elektronik", "Unit", 2022, "Lab Komputer", "Baik", 10, 2, 7500000, "Untuk praktik siswa"),
    ("Komputer PC Core i5", "inventaris", "Alat Elektronik", "Unit", 2021, "Lab Komputer", "Baik", 15, 3, 6500000, ""),
    ("Printer Epson L3210", "inventaris", "Alat Elektronik", "Unit", 2023, "Ruang TU", "Baik", 3, 1, 2600000, ""),
    ("Proyektor Epson EB-X51", "inventaris", "Alat Elektronik", "Unit", 2022, "Ruang Kelas", "Baik", 4, 1, 6800000, ""),
    ("AC 1 PK Daikin", "inventaris", "Alat Elektronik", "Unit", 2020, "Ruang Guru", "Rusak Ringan", 3, 1, 5200000, "1 unit pendinginan berkurang"),
    ("Bola Voli Mikasa", "inventaris", "Lainnya", "Buah", 2024, "Gudang Utama", "Baik", 8, 2, 320000, ""),
    ("Alat Peraga Matematika", "inventaris", "Lainnya", "Set", 2022, "Perpustakaan", "Baik", 4, 1, 750000, ""),
]

# (nama barang, hari yang lalu, jumlah, harga satuan, sumber dana, keterangan)
SEED_MASUK = [
    ("Meja Siswa", 200, 50, 340000, "Komite", "Pembelian meja kelas baru"),
    ("Kursi Siswa", 200, 50, 195000, "Komite", "Pembelian kursi kelas baru"),
    ("Kertas A4 Sinar Dunia", 150, 500, 52000, "BOS Reguler", "Pengadaan ATK triwulan I"),
    ("Pulpen Standard AE7", 140, 200, 2800, "BOS Reguler", "Pengadaan ATK triwulan I"),
    ("Pensil 2B", 140, 100, 4800, "BOS Reguler", "Pengadaan ATK triwulan I"),
    ("Tinta Printer Epson 003 Hitam", 120, 6, 93000, "Komite", "Persediaan cetak administrasi"),
    ("Cairan Pembersih Lantai", 90, 12, 24000, "BOS Kinerja", "Pengadaan alat kebersihan"),
    ("Sapu Ijuk", 85, 10, 33000, "BOS Kinerja", "Pengadaan alat kebersihan"),
    ("Pel Lantai Putar", 85, 6, 82000, "BOS Kinerja", "Pengadaan alat kebersihan"),
    ("Laptop Asus", 75, 5, 7300000, "Hibah", "Bantuan pembelajaran TIK"),
    ("Komputer PC Core i5", 75, 5, 6400000, "Hibah", "Bantuan lab komputer"),
    ("Ember 20 Liter", 60, 8, 38000, "BOS Reguler", "Pengadaan alat kebersihan"),
    ("Proyektor Epson EB-X51", 30, 2, 6700000, "BOS Reguler", "Pengadaan proyektor kelas"),
    ("Kertas A4 Sinar Dunia", 20, 100, 54000, "BOS Kinerja", "Pengadaan ATK triwulan II"),
]

# (nama barang, hari yang lalu, jumlah, penerima, keterangan)
SEED_KELUAR = [
    ("Meja Siswa", 150, 20, "Kelas 2", "Distribusi meja"),
    ("Kursi Siswa", 150, 20, "Kelas 2", "Distribusi kursi"),
    ("Laptop Asus", 70, 2, "Ruang Kelas 5", "Penempatan unit kelas"),
    ("Kertas A4 Sinar Dunia", 60, 120, "Ibu Sari (TU)", "Kop surat & administrasi"),
    ("Pulpen Standard AE7", 55, 80, "Ruang TU", "Administrasi harian"),
    ("Pensil 2B", 50, 60, "Guru Kelas 3", "Latihan siswa"),
    ("Map Folder Kancing", 40, 25, "Wakasek Kurikulum", "Arsip nilai"),
    ("Tinta Printer Epson 003 Hitam", 40, 11, "Ruang TU", "Cetak rapor semester"),
    ("Cairan Pembersih Lantai", 45, 6, "Petugas Kebersihan", "Pembersihan ruang kelas"),
    ("Sapu Ijuk", 35, 6, "Petugas Kebersihan", "Penggantian sapu aus"),
    ("Pel Lantai Putar", 33, 4, "Petugas Kebersihan", "Unit rusak"),
    ("Ember 20 Liter", 30, 6, "Petugas Kebersihan", "Distribusi kelas"),
    ("Tempat Sampah", 30, 4, "Petugas Kebersihan", "Distribusi kelas 1-6"),
    ("Kursi Siswa", 95, 18, "Kelas 5", "Distribusi kursi"),
    ("Meja Siswa", 100, 15, "Kelas 4", "Distribusi meja"),
    ("Printer Epson L3210", 20, 1, "Perpustakaan", "Penempatan unit perpustakaan"),
    ("Cairan Pembersih Lantai", 10, 4, "Petugas Kebersihan", "Pembersihan aula"),
    ("Kertas A4 Sinar Dunia", 25, 95, "Guru Matematika", "Soal ulangan"),
]


def d(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


async def main() -> None:
    force = os.environ.get("FORCE_SEED") == "1"
    if not force and await db.users.count_documents({}) > 0:
        print("Data sudah ada - seed dilewati. Gunakan FORCE_SEED=1 untuk mengganti data.")
        return
    if force:
        for c in ["users", "items", "item_transactions", "stock_opnames", "audit_logs", "school_profile",
                  "categories", "locations"]:
            await db[c].drop()
        await ensure_indexes()

    # --- Pengguna ---
    users = []
    for u in SEED_USERS:
        users.append({
            "id": new_id(), "nama": u["nama"], "username": u["username"], "email": u["email"],
            "role": u["role"], "nip": u["nip"], "foto": "", "aktif": True,
            "password_hash": hash_password(u["password"]), "created_at": now_utc(), "updated_at": now_utc(),
        })
    await db.users.insert_many(users)

    # --- Profil sekolah ---
    await db.school_profile.update_one(
        {"id": "profil"}, {"$set": SEED_PROFILE, "$setOnInsert": {"id": "profil"}}, upsert=True
    )

    # --- Master data: kategori & lokasi ---
    await db.categories.insert_many([
        {"id": new_id(), "kode": kode, "nama": nama, "keterangan": "", "aktif": True,
         "created_at": now_utc(), "updated_at": now_utc()}
        for nama, kode in SEED_CATEGORIES
    ])
    await db.locations.insert_many([
        {"id": new_id(), "kode": kode, "nama": nama, "gedung": gedung, "ruang": nama, "keterangan": "",
         "aktif": True, "created_at": now_utc(), "updated_at": now_utc()}
        for nama, kode, gedung in SEED_LOCATIONS
    ])

    # --- Master barang ---
    items_by_name: dict[str, dict] = {}
    admin = users[0]
    for it in SEED_ITEMS:
        item = Item(
            nama=it[0], jenis=it[1], kategori=it[2], satuan=it[3], tahun=it[4], lokasi=it[5],
            kondisi=it[6], stok_awal=it[7], stok_minimum=it[8], harga_satuan=it[9], keterangan=it[10],
            created_by=admin["id"], updated_by=admin["id"],
        )
        item.kode = await next_kode()
        item.stok = item.stok_awal
        doc = item.model_dump()
        await db.items.insert_one(doc)
        items_by_name[it[0]] = doc

    # --- Transaksi (kronologis, nomor otomatis per tahun) ---
    txs: list[tuple[str, str, str, int, float, str, str, str]] = []
    for nama, days, jumlah, harga, sumber, ket in SEED_MASUK:
        txs.append((d(days), "masuk", nama, jumlah, harga, sumber, "", ket))
    for nama, days, jumlah, penerima, ket in SEED_KELUAR:
        txs.append((d(days), "keluar", nama, jumlah, 0, "", penerima, ket))
    txs.sort(key=lambda t: t[0])

    pengurus = users[1]
    for tanggal, jenis, nama, jumlah, harga, sumber, penerima, ket in txs:
        item = items_by_name[nama]
        prefix = "BM" if jenis == "masuk" else "BK"
        nomor = await next_nomor("item_transactions", prefix, int(tanggal[:4]))
        await db.item_transactions.insert_one({
            "id": new_id(), "nomor": nomor, "jenis": jenis, "tanggal": tanggal, "item_id": item["id"],
            "kode_barang": item["kode"], "nama_barang": item["nama"], "kategori": item["kategori"],
            "satuan": item["satuan"], "jumlah": jumlah, "harga_satuan": harga, "total_harga": harga * jumlah,
            "sumber_dana": sumber, "penerima": penerima, "lokasi": item.get("lokasi", ""),
            "kondisi": item.get("kondisi", "Baik"), "keterangan": ket,
            "nomor_dokumen": "", "tujuan": "", "keperluan": ket if jenis == "keluar" else "",
            "status": "active", "deleted_at": None, "opname_id": "",
            "user_id": pengurus["id"], "user_name": pengurus["nama"],
            "created_at": now_utc(), "updated_at": now_utc(),
        })

    # --- Stok konsisten dengan histori ---
    for item in items_by_name.values():
        await recalc_stock(item["id"])

    # --- Contoh stok opname (draft, belum disesuaikan) ---
    details = []
    opname_rows = [
        ("Sapu Ijuk", -1, "Terdapat 1 unit aus/tidak layak"),
        ("Pel Lantai Putar", 0, ""),
        ("Ember 20 Liter", 1, "Stok gudang lebih"),
        ("Cairan Pembersih Lantai", 0, ""),
        ("Tempat Sampah", 1, "Ada 1 unit di belakang gudang"),
    ]
    for nama, delta, ket in opname_rows:
        it = await db.items.find_one({"id": items_by_name[nama]["id"]})
        details.append({
            "item_id": it["id"], "kode": it["kode"], "nama": it["nama"], "satuan": it["satuan"],
            "stok_sistem": it["stok"], "stok_fisik": it["stok"] + delta, "selisih": delta, "keterangan": ket,
        })
    nomor_so = await next_nomor("stock_opnames", "SO", int(d(7)[:4]))
    await db.stock_opnames.insert_one({
        "id": new_id(), "nomor": nomor_so, "tanggal": d(7), "lokasi": "Gudang Utama",
        "kategori": "Alat Kebersihan", "petugas": pengurus["nama"], "status": "draft", "details": details,
        "user_id": pengurus["id"], "user_name": pengurus["nama"], "created_at": now_utc(),
    })

    print("Seed selesai. Akun pengujian:")
    print("  Administrator : admin / admin123")
    print("  Pengurus Barang: pengurus / pengurus123")


if __name__ == "__main__":
    asyncio.run(main())
