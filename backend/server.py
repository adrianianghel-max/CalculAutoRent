from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional

from calc import calculeaza
from holidays_ro import DEFAULT_HOLIDAYS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Calcul Rent Auto RCA")
api_router = APIRouter(prefix="/api")


class Holiday(BaseModel):
    date: str
    name: str


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
    rec1_start: Optional[str] = None
    rec1_end: Optional[str] = None
    rec2_start: Optional[str] = None
    rec2_end: Optional[str] = None

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
    return calculeaza(payload)


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
