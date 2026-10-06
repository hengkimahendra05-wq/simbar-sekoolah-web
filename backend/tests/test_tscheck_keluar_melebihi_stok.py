"""Criterion: Barang keluar melebihi stok ditolak dengan pesan yang jelas (400),
dan transaksi TIDAK tersimpan (stok tidak berubah).
"""
import uuid


def test_outbound_exceeding_stock_is_rejected(admin_client):
    suffix = uuid.uuid4().hex[:8]
    kode = f"TSCHECK-OVER-{suffix}"

    r = admin_client.post("/items", json={
        "kode": kode,
        "nama": f"tscheck-over-item-{suffix}",
        "jenis": "persediaan",
        "kategori": "ATK",
        "satuan": "Buah",
        "stok_awal": 10,
        "harga_satuan": 500,
    })
    assert r.status_code == 201, r.text
    item_id = r.json()["id"]

    r = admin_client.post("/transactions", json={
        "jenis": "keluar",
        "tanggal": "2026-01-12",
        "item_id": item_id,
        "jumlah": 99999,
    })
    assert r.status_code == 400, r.text
    body = r.json()
    detail = body.get("detail", "")
    assert "Stok tidak mencukupi" in detail
    assert "10" in detail

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 10

    r = admin_client.get("/transactions", params={"item_id": item_id})
    assert r.status_code == 200
    assert len(r.json()) == 0
