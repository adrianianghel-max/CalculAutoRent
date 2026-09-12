"""Backend tests for RCA rent calculator API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://auto-rent-compute.preview.emergentagent.com").rstrip("/")

DEFAULT_PAYLOAD = {
    "nr_dosar": "U21201993163",
    "marca_pagubit": "HYUNDAI ELANTRA",
    "status_deplasare": "NEDEPLASABIL",
    "data_emitere_rca": "2026-06-11",
    "piese_acceptat": 25614.9,
    "materiale_vopsitorie_acceptat": 2409.44,
    "manopera_acceptat": 4494,
    "tva_percent": 21,
    "ore_tinichigerie": 21.6,
    "ore_vopsitorie": 10.5,
    "auto_inchiriat_marca": "OPEL ASTRA",
    "auto_inchiriat_clasa": "SIMILAR",
    "auto_oferta_marca": "MERCEDES A",
    "pret_facturat": 363,
    "pret_oferta": 541.18,
    "tva_label": "CU TVA",
    "zile_facturate": 30,
    "data_avizare": "2026-07-14",
    "data_constatare": "2026-07-15",
    "rent_start": "2026-07-14",
    "rent_end": "2026-08-14",
    "rep_start": "2026-07-14",
    "rep_end": "2026-08-14",
    "motivare_reparatie": "cf. deviz Audatex refacut.",
    "observatii": "",
    "semnatura": "",
    "holidays": [],
}


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/holidays ---
def test_get_holidays(client):
    r = client.get(f"{BASE_URL}/api/holidays")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    assert "date" in data[0] and "name" in data[0]


# --- /api/calculate default sample ---
def test_calculate_default_sample(client):
    r = client.post(f"{BASE_URL}/api/calculate", json=DEFAULT_PAYLOAD)
    assert r.status_code == 200
    d = r.json()
    assert d["zile_rent"] == 15
    assert d["suma_rent"] == 5445.0
    assert d["valoare_reparatie"] == 39347.19
    assert d["norma"] == "N18 dupa incetarea HG298"
    assert d["zile_reparatie"] == 9
    assert d["ore_total"] == 32.1
    assert len(d["day_list"]) == 15
    assert "plata a 15 zile" in d["letter_text"]
    assert "cu un total de 5445 lei" in d["letter_text"]


# --- repair value formula ---
def test_valoare_reparatie_formula(client):
    p = {**DEFAULT_PAYLOAD, "piese_acceptat": 25614.9, "materiale_vopsitorie_acceptat": 2409.44,
         "manopera_acceptat": 4494, "tva_percent": 21}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    assert r.json()["valoare_reparatie"] == 39347.19


# --- norma detection ---
@pytest.mark.parametrize("d,expected", [
    ("2022-09-10", "N20"),
    ("2022-01-01", "N20"),
    ("2023-04-11", "N18"),
    ("2022-09-11", "N18"),
    ("2025-06-30", "HG298"),
    ("2023-04-12", "HG298"),
    ("2025-07-01", "N18 dupa incetarea HG298"),
    ("2026-06-11", "N18 dupa incetarea HG298"),
])
def test_norma_detection(client, d, expected):
    p = {**DEFAULT_PAYLOAD, "data_emitere_rca": d}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    assert r.json()["norma"] == expected


# --- zile_facturate cap ---
def test_zile_facturate_cap(client):
    p = {**DEFAULT_PAYLOAD, "zile_facturate": 10}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    d = r.json()
    assert d["zile_rent"] == 10
    assert d["warning"] and "depaseste" in d["warning"].lower()


# --- no overlap warning ---
def test_no_overlap_warning(client):
    p = {**DEFAULT_PAYLOAD, "rent_start": "2026-09-01", "rent_end": "2026-09-10"}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    d = r.json()
    assert d["zile_rent"] == 0
    assert d["warning"] and "nu se suprapun" in d["warning"]


# --- culpa periods add days ---
def test_culpa_periods(client):
    # add rec1: 2026-07-16 to 2026-07-17 (2 days). These days would normally be reparatie
    # but should be tagged 'culpa'
    p = {**DEFAULT_PAYLOAD, "culpa_periods": [{"label": "reconstatare", "start": "2026-07-16", "end": "2026-07-17"}]}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    d = r.json()
    culpa_days = [x for x in d["day_list"] if x["type"] == "culpa"]
    assert len(culpa_days) >= 2
    labels = [x["label"] for x in culpa_days]
    assert "reconstatare" in labels


# --- holiday inside repair window ---
def test_holiday_inside_repair(client):
    # add a fake holiday within a weekday of the intersection
    p = {**DEFAULT_PAYLOAD, "holidays": [{"date": "2026-07-20", "name": "Test Holiday"}]}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    d = r.json()
    liber_days = [x for x in d["day_list"] if x["type"] == "liber"]
    assert any(x["date"] == "20.07.2026" for x in liber_days)


# --- price abuse logic ---
def test_price_abuse_true(client):
    # oferta*1.2 < facturat => abuz
    p = {**DEFAULT_PAYLOAD, "pret_oferta": 100, "pret_facturat": 200}
    r = client.post(f"{BASE_URL}/api/calculate", json=p)
    d = r.json()
    assert d["abuz_pret"] is True
    # suma = oferta * zile
    assert d["suma_rent"] == round(100 * d["zile_rent"], 2)


# --- /api/cui-lookup ---
def test_cui_lookup_valid(client):
    r = client.post(f"{BASE_URL}/api/cui-lookup", json={"cui": "27416331"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "AUTOSERVICE" in (d.get("denumire") or "").upper()
    assert (d.get("judet") or "").upper() == "SIBIU"
    assert d.get("adresa")


def test_cui_lookup_invalid_format(client):
    r = client.post(f"{BASE_URL}/api/cui-lookup", json={"cui": "ab"})
    assert r.status_code == 422


def test_cui_lookup_nonexistent(client):
    r = client.post(f"{BASE_URL}/api/cui-lookup", json={"cui": "12345678"})
    assert r.status_code in (200, 404), r.text
    assert r.status_code != 500


def test_price_abuse_false(client):
    # default: 541.18*1.2 = 649.416 > 363 => no abuse
    r = client.post(f"{BASE_URL}/api/calculate", json=DEFAULT_PAYLOAD)
    d = r.json()
    assert d["abuz_pret"] is False
    assert d["suma_rent"] == round(363 * d["zile_rent"], 2)
