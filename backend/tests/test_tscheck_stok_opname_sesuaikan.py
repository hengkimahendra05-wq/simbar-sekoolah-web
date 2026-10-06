"""Criterion: Stok opname tidak mengubah stok sampai 'Sesuaikan Stok' dikonfirmasi.
Setelah konfirmasi (POST /opnames/{id}/adjust), status jadi 'disesuaikan', stok
barang berselisih berubah, dan muncul transaksi ADJ-YYYY-nnnn.
"""
import uuid


def test_opname_adjust_confirms_stock_change(admin_client):
    suffix = uuid.uuid4().hex[:8]
    kode = f"TSCHECK-OPN-{suffix}"

    r = admin_client.post("/items", json={
        "kode": kode,
        "nama": f"tscheck-opname-item-{suffix}",
        "jenis": "persediaan",
        "kategori": "ATK",
        "satuan": "Buah",
        "stok_awal": 50,
        "harga_satuan": 500,
    })
    assert r.status_code == 201, r.text
    item_id = r.json()["id"]
    assert r.json()["stok"] == 50

    # Create draft opname with a discrepancy: system says 50, physical count is 45
    r = admin_client.post("/opnames", json={
        "tanggal": "2026-01-15",
        "petugas": "tscheck-petugas",
        "items": [
            {"item_id": item_id, "stok_fisik": 45, "keterangan": "tscheck selisih"}
        ],
    })
    assert r.status_code == 201, r.text
    opname = r.json()
    opname_id = opname["id"]
    assert opname["status"] == "draft"
    assert opname["nomor"].startswith("SO-")

    # Stock must remain unchanged while draft
    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 50

    # Confirm adjustment
    r = admin_client.post(f"/opnames/{opname_id}/adjust")
    assert r.status_code == 200, r.text

    r = admin_client.get("/opnames")
    assert r.status_code == 200
    updated = next(o for o in r.json() if o["id"] == opname_id)
    assert updated["status"] == "disesuaikan"

    r = admin_client.get(f"/items/{item_id}")
    assert r.json()["stok"] == 45

    # An ADJ transaction should now exist in the item's kartu stok
    r = admin_client.get(f"/items/{item_id}/kartu-stok")
    assert r.status_code == 200, r.text
    rows = r.json().get("rows", r.json() if isinstance(r.json(), list) else [])
    text = str(r.json())
    assert "ADJ-" in text
