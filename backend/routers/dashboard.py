"""Dashboard aggregates: KPI cards, chart series, recent transactions."""

from fastapi import APIRouter, Depends

from lib.db import db
from lib.dates import today_iso
from lib.security import get_current_user
from models.inventory import Transaction
from models.ops import DashboardData, MonthPoint, NamedCount, StokKategori

router = APIRouter(tags=["dashboard"])

BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
KATEGORI_ORDER = ["ATK", "Alat Kebersihan", "Meubelair", "Alat Elektronik", "Lainnya"]


@router.get("/dashboard", response_model=DashboardData)
async def dashboard(_: dict = Depends(get_current_user)):
    items = await db.items.find(
        {"deleted_at": None},
        {"stok": 1, "stok_minimum": 1, "jenis": 1, "kategori": 1, "kondisi": 1},
    ).to_list(50000)
    total_jenis = len(items)
    total_persediaan = sum(1 for i in items if i.get("jenis") == "persediaan")
    total_unit = sum(int(i.get("stok", 0)) for i in items)
    stok_menipis = sum(1 for i in items if 0 < int(i.get("stok", 0)) <= int(i.get("stok_minimum", 0)))
    stok_habis = sum(1 for i in items if int(i.get("stok", 0)) <= 0)

    kat_stok: dict[str, int] = {}
    kat_count: dict[str, int] = {}
    kondisi_count: dict[str, int] = {}
    for i in items:
        k = i.get("kategori") or "Lainnya"
        kat_stok[k] = kat_stok.get(k, 0) + int(i.get("stok", 0))
        kat_count[k] = kat_count.get(k, 0) + 1
        kd = i.get("kondisi") or "Baik"
        kondisi_count[kd] = kondisi_count.get(kd, 0) + 1

    order = [k for k in KATEGORI_ORDER] + [k for k in kat_stok if k not in KATEGORI_ORDER]
    stok_kategori = [
        StokKategori(kategori=k, stok=kat_stok.get(k, 0), jenis_count=kat_count.get(k, 0)) for k in order if k
    ]
    kondisi_rows = [
        NamedCount(nama=k, jumlah=kondisi_count[k])
        for k in ["Baik", "Rusak Ringan", "Rusak Berat"]
        if kondisi_count.get(k)
    ]

    today = today_iso()
    y, m = int(today[:4]), int(today[5:7])
    months: list[tuple[str, str]] = []
    for back in range(5, -1, -1):
        mm = m - back
        yy = y + (mm - 1) // 12
        mm = (mm - 1) % 12 + 1
        months.append((f"{yy:04d}-{mm:02d}", BULAN[mm - 1]))
    start = f"{months[0][0]}-01"
    txs = await db.item_transactions.find(
        {"tanggal": {"$gte": start}, "status": "active"}, {"jenis": 1, "tanggal": 1, "jumlah": 1}
    ).to_list(100000)
    tren: dict[str, dict[str, int]] = {key: {"masuk": 0, "keluar": 0} for key, _ in months}
    masuk_bulan_ini = keluar_bulan_ini = 0
    prefix = today[:7]
    for t in txs:
        key = t["tanggal"][:7]
        if t["jenis"] == "penyesuaian":
            continue  # penyesuaian bukan pengadaan/pemakaian — tidak masuk grafik tren
        if key in tren:
            tren[key]["masuk" if t["jenis"] == "masuk" else "keluar"] += int(t["jumlah"])
        if t["tanggal"].startswith(prefix):
            if t["jenis"] == "masuk":
                masuk_bulan_ini += int(t["jumlah"])
            else:
                keluar_bulan_ini += int(t["jumlah"])

    recent = await db.item_transactions.find({"status": "active"}).sort([("tanggal", -1), ("created_at", -1)]).to_list(8)
    return DashboardData(
        total_jenis=total_jenis,
        total_persediaan=total_persediaan,
        total_inventaris=total_jenis - total_persediaan,
        total_unit=total_unit,
        masuk_bulan_ini=masuk_bulan_ini,
        keluar_bulan_ini=keluar_bulan_ini,
        stok_menipis=stok_menipis,
        stok_habis=stok_habis,
        tren_bulanan=[MonthPoint(bulan=k, label=label, masuk=tren[k]["masuk"], keluar=tren[k]["keluar"]) for k, label in months],
        stok_kategori=stok_kategori,
        jumlah_jenis=[
            NamedCount(nama="Persediaan", jumlah=total_persediaan),
            NamedCount(nama="Inventaris/Aset", jumlah=total_jenis - total_persediaan),
        ],
        kondisi=kondisi_rows,
        transaksi_terbaru=[Transaction(**t) for t in recent],
    )
