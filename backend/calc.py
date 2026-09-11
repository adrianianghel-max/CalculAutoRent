"""Reproducere calcul zile inchiriere auto RCA (macro Excel 'Solicitare Acord Plata')."""
import math
from datetime import date, datetime, timedelta
from typing import Optional


# ---------- helpers ----------
def parse_date(v) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            d = datetime.strptime(s, fmt).date()
            if d.year <= 1900:  # placeholder 1900-01-01 in Excel = gol
                return None
            return d
        except ValueError:
            continue
    return None


def to_float(v) -> float:
    if v is None or v == "":
        return 0.0
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return 0.0


def money2(x: float) -> str:
    return f"{x:.2f}"


def trim(x: float) -> str:
    s = f"{x:.6f}".rstrip("0").rstrip(".")
    return s if s else "0"


def fmt_date(d: date) -> str:
    return d.strftime("%d.%m.%Y")


def daterange(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def detecteaza_norma(data_emitere_rca: Optional[date]) -> str:
    if data_emitere_rca is None:
        return "N18 dupa incetarea HG298"
    d = data_emitere_rca
    if d <= date(2022, 9, 10):
        return "N20"
    if d <= date(2023, 4, 11):
        return "N18"
    if d <= date(2025, 6, 30):
        return "HG298"
    return "N18 dupa incetarea HG298"


# ---------- calcul principal ----------
def calculeaza(payload: dict) -> dict:
    dosar = str(payload.get("nr_dosar", "") or "")
    marca_pagubit = str(payload.get("marca_pagubit", "") or "")
    status = str(payload.get("status_deplasare", "") or "")

    data_emitere_rca = parse_date(payload.get("data_emitere_rca"))
    norma = detecteaza_norma(data_emitere_rca)

    # valoare reparatie acceptata = (piese + materiale + manopera) * (1 + tva/100)
    piese = to_float(payload.get("piese_acceptat"))
    materiale = to_float(payload.get("materiale_vopsitorie_acceptat"))
    manopera = to_float(payload.get("manopera_acceptat"))
    tva = to_float(payload.get("tva_percent"))
    baza_rep = piese + materiale + manopera
    valoare_reparatie = round(baza_rep + tva * baza_rep / 100.0, 2)

    ore_tini = round(to_float(payload.get("ore_tinichigerie")), 2)
    ore_vops = round(to_float(payload.get("ore_vopsitorie")), 2)
    ore_total = round(ore_tini + ore_vops, 2)
    zile_reparatie = math.ceil(ore_total / 4) if ore_total > 0 else 0

    pret_facturat = to_float(payload.get("pret_facturat"))
    pret_oferta = to_float(payload.get("pret_oferta"))
    tva_label = str(payload.get("tva_label", "CU TVA") or "CU TVA")
    zile_facturate = int(to_float(payload.get("zile_facturate")))

    auto_inch_marca = str(payload.get("auto_inchiriat_marca", "") or "")
    auto_inch_clasa = str(payload.get("auto_inchiriat_clasa", "") or "")
    auto_oferta_marca = str(payload.get("auto_oferta_marca", "") or "")

    data_avizare = parse_date(payload.get("data_avizare"))
    data_constatare = parse_date(payload.get("data_constatare"))
    rent_start = parse_date(payload.get("rent_start"))
    rent_end = parse_date(payload.get("rent_end"))
    rep_start = parse_date(payload.get("rep_start"))
    rep_end = parse_date(payload.get("rep_end"))
    rec1_start = parse_date(payload.get("rec1_start"))
    rec1_end = parse_date(payload.get("rec1_end"))
    rec2_start = parse_date(payload.get("rec2_start"))
    rec2_end = parse_date(payload.get("rec2_end"))

    # zile culpabile (reconstatare / comanda piese)
    zile_culpa = {}
    if rec1_start and rec1_end:
        for d in daterange(rec1_start, rec1_end):
            zile_culpa[d] = "reconstatare"
    if rec2_start and rec2_end:
        for d in daterange(rec2_start, rec2_end):
            zile_culpa[d] = "comanda piese"

    zile_rec1 = (rec1_end - rec1_start).days + 1 if (rec1_start and rec1_end) else 0
    zile_rec2 = (rec2_end - rec2_start).days + 1 if (rec2_start and rec2_end) else 0

    # zile libere legale
    zile_libere = {}
    for h in payload.get("holidays", []):
        hd = parse_date(h.get("date"))
        if hd:
            zile_libere[hd] = str(h.get("name", "") or "sarbatoare legala")

    day_list = []
    zile_rent = 0
    warning = ""

    if rent_start and rent_end and rep_start and rep_end:
        start_int = max(rent_start, rep_start)
        end_int = min(rent_end, rep_end)

        if start_int <= end_int:
            # construire multime {avizare-constatare} U {intersectie}
            multime = {}
            if data_avizare and data_constatare and (data_constatare - data_avizare).days >= 1:
                for d in daterange(data_avizare, data_constatare):
                    multime.setdefault(d, "avizare-constatare")
            for d in daterange(start_int, end_int):
                multime.setdefault(d, "intersectie")

            zile_rep_efective = 0
            inceput_reparatie = False
            for d in sorted(multime.keys()):
                tip = multime[d]
                if tip == "avizare-constatare":
                    zile_rent += 1
                    day_list.append({"date": fmt_date(d), "label": "perioada avizare-constatare", "type": "avizare"})
                    continue
                inceput_reparatie = True
                if not inceput_reparatie:
                    continue
                if d in zile_culpa:
                    zile_rent += 1
                    day_list.append({"date": fmt_date(d), "label": zile_culpa[d], "type": "culpa"})
                elif d in zile_libere:
                    zile_rent += 1
                    day_list.append({"date": fmt_date(d), "label": zile_libere[d], "type": "liber"})
                else:
                    if zile_rep_efective < zile_reparatie:
                        if d.weekday() <= 4:
                            zile_rent += 1
                            zile_rep_efective += 1
                            day_list.append({"date": fmt_date(d), "label": "reparatie", "type": "reparatie"})
                        else:
                            zile_rent += 1
                            day_list.append({"date": fmt_date(d), "label": "weekend", "type": "weekend"})

            # limitare la zile facturate
            if zile_facturate > 0 and zile_rent > zile_facturate:
                warning = f"Numarul calculat ({zile_rent}) depaseste zilele facturate; limitat la {zile_facturate}."
                zile_rent = zile_facturate
        else:
            warning = "Perioada rent si perioada reparatie nu se suprapun."
    else:
        warning = "Completati perioadele de rent si reparatie pentru calcul."

    # suma rent (formula Excel: IF(oferta*1.2 < facturat, oferta*zile, facturat*zile))
    oferta_majorata = round(pret_oferta * 1.2, 6)
    if oferta_majorata < pret_facturat:
        suma_rent = round(pret_oferta * zile_rent, 2)
    else:
        suma_rent = round(pret_facturat * zile_rent, 2)

    rent_total = (rent_end - rent_start).days if (rent_start and rent_end) else 0
    rep_total = (rep_end - rep_start).days if (rep_start and rep_end) else 0

    # ---------- construire scrisoare ----------
    motivare_rep = str(payload.get("motivare_reparatie", "") or "").strip()
    observatii = str(payload.get("observatii", "") or "").strip()
    semnatura = str(payload.get("semnatura", "") or "").strip()

    L = []
    L.append("Salut!")
    L.append(f"Rog acord plata dosar {dosar} astfel:")
    L.append(f"Pentru reparatie suma de {money2(valoare_reparatie)} lei {motivare_rep}".rstrip())
    L.append(f"Pentru inchiriere suma de {trim(suma_rent)} lei cf. calculatie de mai jos:")
    L.append("")
    L.append(f"Calcul lipsa de folosinta dupa norma {norma}, {status}")
    L.append("")
    if data_avizare:
        L.append(f"Data AVIZARII: {fmt_date(data_avizare)}")
    if data_constatare:
        L.append(f"Data Constatarii: {fmt_date(data_constatare)}")
    if rent_start and rent_end:
        L.append(f"Perioada rent : {fmt_date(rent_start)} - {fmt_date(rent_end)} total {rent_total} zile")
    if rep_start and rep_end:
        L.append(f"Perioada rep : {fmt_date(rep_start)} - {fmt_date(rep_end)} total {rep_total} zile")
    if rec1_start and rec1_end:
        L.append(f"Perioada rec : {fmt_date(rec1_start)} - {fmt_date(rec1_end)} total {zile_rec1} zile")
    if rec2_start and rec2_end:
        L.append(f"Perioada comanda piese : {fmt_date(rec2_start)} - {fmt_date(rec2_end)} total {zile_rec2} zile")
    L.append(f"Timp manopera tinichigerie : {trim(ore_tini)} h")
    L.append(f"Timp manopera vopsitorie : {trim(ore_vops)} h")
    L.append(f"TOTAL ORE MANOPERA : {trim(ore_total)} h")
    L.append("")
    L.append(f"ZILE INCHIRIERE DIN REPARATIE: {trim(ore_total)} h : 4 = {zile_reparatie} zile rotunjite la intreg")
    L.append("")
    L.append("")
    for item in day_list:
        L.append(f"• {item['date']} - {item['label']}")
    L.append("")
    if observatii:
        L.append(observatii)
        L.append("")
    L.append(f"Au fost facturate : {zile_facturate} zile")
    L.append(f"Auto avariat : {marca_pagubit}")
    L.append(
        f"Auto inchiriat : {auto_inch_marca} {auto_inch_clasa} clasei celui avariat la pretul de "
        f"{money2(pret_facturat)} lei pe zi {tva_label}"
    )
    L.append(
        f"Auto oferta rentalcars: {auto_oferta_marca} la pretul de {trim(pret_oferta)} lei pe zi {tva_label}"
    )
    if oferta_majorata < pret_facturat:
        L.append(f"{trim(pret_oferta)} + 20% = {trim(oferta_majorata)} < {trim(pret_facturat)}")
        L.append(
            f"Propun instrumentarea dosarului {dosar} ca abuz inchiriere si plata a {zile_rent} zile "
            f"la pretul din oferta rentalcars de {trim(pret_oferta)} lei pe zi {tva_label} cu un total de {trim(suma_rent)} lei."
        )
    else:
        L.append(f"{trim(pret_oferta)} + 20% = {trim(oferta_majorata)} > {trim(pret_facturat)}")
        L.append(
            f"Propun instrumentarea dosarului {dosar} si plata a {zile_rent} zile "
            f"la pretul din oferta facturata de {trim(pret_facturat)} lei pe zi {tva_label} cu un total de {trim(suma_rent)} lei."
        )
    L.append("")
    L.append("")
    L.append("Multumesc !")
    if semnatura:
        L.append("")
        L.append("")
        L.append(semnatura)

    letter_text = "\n".join(L)

    return {
        "zile_rent": zile_rent,
        "suma_rent": suma_rent,
        "valoare_reparatie": valoare_reparatie,
        "norma": norma,
        "zile_reparatie": zile_reparatie,
        "ore_total": ore_total,
        "oferta_majorata": oferta_majorata,
        "abuz_pret": oferta_majorata < pret_facturat,
        "rent_total": rent_total,
        "rep_total": rep_total,
        "day_list": day_list,
        "letter_text": letter_text,
        "warning": warning,
    }
