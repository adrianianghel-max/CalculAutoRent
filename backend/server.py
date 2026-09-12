from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from datetime import date
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import httpx

from calc import calculeaza
from holidays_ro import DEFAULT_HOLIDAYS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"

app = FastAPI(title="Calcul Rent Auto RCA")
api_router = APIRouter(prefix="/api")


class Holiday(BaseModel):
    date: str
    name: str


class CulpaPeriod(BaseModel):
    label: str = "culpa"
    start: Optional[str] = None
    end: Optional[str] = None


class CalcRequest(BaseModel):
    nr_dosar: str = ""
    marca_pagubit: str = ""
    status_deplasare: str = "NEDEPLASABIL"
    data_emitere_rca: Optional[str] = None

    piese_acceptat: float = 0
    materiale_vopsitorie_acceptat: float = 0
    manopera_acceptat: float = 0
    tva_percent: float = 21

    ore_tinichigerie: float = 0
    ore_vopsitorie: float = 0

    auto_inchiriat_marca: str = ""
    auto_inchiriat_clasa: str = ""
    auto_oferta_marca: str = ""
    pret_facturat: float = 0
    pret_oferta: float = 0
    tva_label: str = "CU TVA"
    zile_facturate: float = 0

    data_avizare: Optional[str] = None
    data_constatare: Optional[str] = None
    rent_start: Optional[str] = None
    rent_end: Optional[str] = None
    rep_start: Optional[str] = None
    rep_end: Optional[str] = None
    culpa_periods: List[CulpaPeriod] = []

    motivare_reparatie: str = ""
    observatii: str = ""
    semnatura: str = ""

    holidays: List[Holiday] = []


@api_router.get("/")
async def root():
    return {"message": "Calcul Rent Auto RCA API"}


@api_router.get("/holidays", response_model=List[Holiday])
async def get_holidays():
    return DEFAULT_HOLIDAYS


@api_router.post("/calculate")
async def calculate(req: CalcRequest):
    payload = req.model_dump()
    payload["holidays"] = [h if isinstance(h, dict) else h.model_dump() for h in payload.get("holidays", [])]
    payload["culpa_periods"] = [c if isinstance(c, dict) else c.model_dump() for c in payload.get("culpa_periods", [])]
    return calculeaza(payload)


class CuiRequest(BaseModel):
    cui: str


def _join_adresa(a: dict) -> str:
    parts = [
        a.get("sdenumire_Strada"), a.get("snumar_Strada"),
        a.get("sdenumire_Localitate"), a.get("sdenumire_Judet"),
        a.get("scod_Postal"),
    ]
    return ", ".join(str(x).strip() for x in parts if x and str(x).strip())


@api_router.post("/cui-lookup")
async def cui_lookup(req: CuiRequest):
    cui = (req.cui or "").strip().upper()
    if cui.startswith("RO"):
        cui = cui[2:]
    cui = "".join(ch for ch in cui if ch.isdigit())
    if not (2 <= len(cui) <= 10):
        raise HTTPException(status_code=422, detail="CUI invalid (2-10 cifre)")

    payload = [{"cui": int(cui), "data": date.today().isoformat()}]
    headers = {"Content-Type": "application/json", "Accept": "application/json",
               "User-Agent": "calcul-rent-rca/1.0"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ANAF_URL, json=payload, headers=headers)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="ANAF indisponibil momentan")

    if resp.status_code == 429:
        raise HTTPException(status_code=503, detail="Limita ANAF atinsa, reincercati")
    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail="Eroare server ANAF")
    try:
        body = resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Raspuns ANAF invalid")

    found = body.get("found") or []
    if not found:
        raise HTTPException(status_code=404, detail="CUI negasit la ANAF")

    rec = found[0]
    general = rec.get("date_generale") or {}
    office = rec.get("adresa_sediu_social") or {}
    return {
        "cui": str(general.get("cui", cui)),
        "denumire": general.get("denumire") or "",
        "adresa": (general.get("adresa") or _join_adresa(office) or "").strip(),
        "judet": office.get("sdenumire_Judet") or "",
        "localitate": office.get("sdenumire_Localitate") or "",
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
