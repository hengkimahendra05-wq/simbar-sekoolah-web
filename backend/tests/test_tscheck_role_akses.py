"""Criterion: Hak akses berdasarkan role — pengurus ditolak (403) pada endpoint
admin-only (/users, /audit, /stock/recalc-apply), admin diperbolehkan.
"""


def test_pengurus_forbidden_on_admin_endpoints(pengurus_client, admin_client):
    r = pengurus_client.get("/users")
    assert r.status_code == 403, r.text

    r = pengurus_client.get("/audit")
    assert r.status_code == 403, r.text

    # Admin should be allowed
    r = admin_client.get("/users")
    assert r.status_code == 200, r.text

    r = admin_client.get("/audit")
    assert r.status_code == 200, r.text
