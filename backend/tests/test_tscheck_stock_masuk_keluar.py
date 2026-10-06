"""Criterion: Stok bertambah saat barang masuk dan berkurang saat barang keluar.

stok = stok_awal + Σmasuk − Σkeluar (hanya transaksi active).
"""
import uuid


def test_stock_increases_on_masuk_and_decreases_on_keluar(admin_client):
    suffix = uuid.uuid4().hex[:8]
    kode = f"TSCHECK-{suffix}"

    r = admin_client.post("/items", json={
        "kode": kode,
        "nama": f"tscheck-stock-item-{suffix}",
        "jenis": "persediaan",
        "kategori": "ATK",
        "satuan": "Buah",
        "stok_awal": 100,
        "harga_satuan": 1000,
    })
    assert r.status_code == 201, r.text
    item = r.json()
    item_id = item["id"]
    assert item["stok"] == 100

    # Barang masuk 50
    r = admin_client.post("/transactions", json={
        "jenis": "masuk",
        "tanggal": "2026-01-10",
        "item_id": item_id,
        "jumlah": 50,
        "harga_satuan": 1000,
    })
    assert r.status_code == 201, r.text
    trx_masuk = r.json()
    assert trx_masuk["nomor"].startswith("BM-")
    assert trx_masuk["total_harga"] == 50000

    r = admin_client.get(f"/items/{item_id}")
    assert r.status_code == 200
    assert r.json()["stok"] == 150

    # Barang keluar 20
    r = admin_client.post("/transactions", json={
        "jenis": "keluar",
        "tanggal": "2026-01-11",
        "item_id": item_id,
        "jumlah": 20,
    })
    assert r.status_code == 201, r.text
    trx_keluar = r.json()
    assert trx_keluar["nomor"].startswith("BK-")

    r = admin_client.get(f"/items/{item_id}")
    assert r.status_code == 200
    assert r.json()["stok"] == 130
