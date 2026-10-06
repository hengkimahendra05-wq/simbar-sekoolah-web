"""Criterion: Hapus transaksi (soft delete) menghilangkan pengaruhnya terhadap stok
namun histori tetap aman; transaksi tidak lagi muncul di daftar aktif.
"""
import uuid


def test_delete_transaction_restores_stock_and_hides_from_list(admin_client):
    suffix = uuid.uuid4().hex[:8]
    kode = f"TSCHECK-DEL-{suffix}"

    r = admin_client.post("/items", json={
        "kode": kode,
        "nama": f"tscheck-delete-item-{suffix}",
        "jenis": "persediaan",
        "kategori": "ATK",
        "satuan": "Buah",
        "stok_awal": 100,
        "harga_satuan": 500,
    })
    assert r.status_code == 201, r.text
    item_id = r.json()["id"]

    r = admin_client.post("/transactions", json={
        "jenis": "masuk",
        "tanggal": "2026-01-10",
        "item_id": item_id,
        "jumlah": 50,
        "harga_satuan": 500,
    })
    assert r.status_code == 201, r.text
    masuk_id = r.json()["id"]
    masuk_nomor = r.json()["nomor"]

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 150

    # Delete the masuk transaction -> stock goes back to 100
    r = admin_client.delete(f"/transactions/{masuk_id}")
    assert r.status_code == 200, r.text

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 100

    # It should no longer appear in the active transactions list
    r = admin_client.get("/transactions", params={"item_id": item_id})
    assert r.status_code == 200
    nomors = [t["nomor"] for t in r.json()]
    assert masuk_nomor not in nomors

    # Now test keluar deletion restores subtracted stock
    r = admin_client.post("/transactions", json={
        "jenis": "keluar",
        "tanggal": "2026-01-11",
        "item_id": item_id,
        "jumlah": 30,
    })
    assert r.status_code == 201, r.text
    keluar_id = r.json()["id"]
    keluar_nomor = r.json()["nomor"]

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 70

    r = admin_client.delete(f"/transactions/{keluar_id}")
    assert r.status_code == 200, r.text

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 100

    r = admin_client.get("/transactions", params={"item_id": item_id})
    nomors = [t["nomor"] for t in r.json()]
    assert keluar_nomor not in nomors
