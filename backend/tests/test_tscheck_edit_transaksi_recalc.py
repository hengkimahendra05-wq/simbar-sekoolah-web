"""Criterion: Edit transaksi membatalkan pengaruh transaksi lama, bukan menumpuk.

Stok awal 100 + masuk 50 (stok 150), edit jadi 70 -> 170 (bukan 220).
Lalu keluar 20, edit jadi 40 -> 130 (bukan 110 hasil pengurangan ganda).
"""
import uuid


def test_edit_transaction_recalculates_not_stacks(admin_client):
    suffix = uuid.uuid4().hex[:8]
    kode = f"TSCHECK-EDIT-{suffix}"

    r = admin_client.post("/items", json={
        "kode": kode,
        "nama": f"tscheck-edit-item-{suffix}",
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

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 150

    # Edit masuk transaction 50 -> 70
    r = admin_client.put(f"/transactions/{masuk_id}", json={
        "jumlah": 70,
    })
    assert r.status_code == 200, r.text

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 170  # not 220

    r = admin_client.post("/transactions", json={
        "jenis": "keluar",
        "tanggal": "2026-01-11",
        "item_id": item_id,
        "jumlah": 20,
    })
    assert r.status_code == 201, r.text
    keluar_id = r.json()["id"]

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 150

    # Edit keluar transaction 20 -> 40
    r = admin_client.put(f"/transactions/{keluar_id}", json={
        "jumlah": 40,
    })
    assert r.status_code == 200, r.text

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 130  # not 110
