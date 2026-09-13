export const DEFAULT_OBSERVATII =
  "Pentru reanalizarea numarului de zile de rent avem nevoie de comenzile ferme de piese si facturile de intrari piese care justifica suplimentarea numarului de zile stationate in service pana la numarul de zile facturate.\nDin documentatia trimisa pentru comanda pieselor nu rezulta concret data comenzii ferme de piese si data livrarii.";

export const DEFAULT_SEMNATURA =
  "Adrian Anghel\nInspector Daune\nGroupama Asigurari\nB-dul Marasti nr. 2, sector 1, 011467 Bucuresti, Romania\nMobil: +(4) 0748.252.361\nE-mail: adrian.anghel@groupama.ro\nwww.groupama.ro\nAlo Groupama: 0374-110-110";

export const DEFAULT_EMAIL_TO =
  "robert.fir@groupama.ro; sorin.barbu@groupama.ro; csaba.szekely@groupama.ro";

export const DEFAULT_FORM = {
  // ---- DATE PAGUBIT ----
  nr_dosar: "U21201993163",
  marca_model: "HYUNDAI ELANTRA",
  numar_inmatriculare: "SB95VKZ",
  nume_pagubit: "GHEORGHE IULIAN",
  adresa_pagubit: "JUD SIBIU, MUN SIBIU, STR DEVENTER, NR 25, BL 4, SCARA B, AP 33",
  nume_cesionar: "M & T AUTOSERVICE",
  cui_cesionar: "27416331",
  adresa_cesionar: "STR. MASINISTILOR 23 JUD. SIBIU, LOC. SIBIU",
  data_eveniment: "11/07/2026",
  data_depunere_cd: "26/08/2026",
  status_deplasare: "NEDEPLASABIL",

  // ---- DATE FACTURA REPARATIE ----
  rep_factura_nr: "2026593",
  rep_factura_data: "26/08/2026",
  rep_emitent: "M & T AUTOSERVICE",
  rep_cui: "27416331",
  rep_localitate: "SIBIU",
  valoare_desp_rep_facturata: "80455.01",
  ora_manopera_facturata: "450",
  ora_manopera_acceptata: "140",

  // ---- DIFERENTE DESPAGUBIRE REPARATIE (facturat vs acceptat) ----
  piese_facturat: "46380.02",
  piese_acceptat: "25614.90",
  materiale_facturat: "2786.72",
  materiale_vopsitorie_acceptat: "2409.44",
  ore_tinichigerie_facturat: "26.80",
  ore_tinichigerie: "21.60",
  ore_vopsitorie_facturat: "11.70",
  ore_vopsitorie: "10.50",
  manopera_facturat: "17325.00",
  manopera_acceptat: "4494.00",
  tva_percent: "21",
  motivare_piese: "NU S-A ACCEPTAT ADAOS COMERCIAL, PIESE NECONSTATATE",
  motivare_materiale: "NU S-A ACCEPTAT ADAOS COMERCIAL, MATERIALE AFERENTE PIESE NECONSTATATE",
  motivare_tinichigerie: "NU SE JUSTIFICA UTILIZAREA",
  motivare_vopsitorie: "MANOPERA AFERENTA PIESE NECONSTATATE",
  motivare_manopera: "DIFERENTA PROVENITA DIN MODIFICAREA PRETULUI OREI DE MANOPERA",

  // ---- DATE FACTURA LIPSA DE FOLOSINTA (RENT) ----
  rent_factura_nr: "2026594",
  rent_factura_data: "26/08/2026",
  rent_emitent: "M & T AUTOSERVICE",
  rent_cui: "27416331",
  rent_localitate: "SIBIU",
  valoare_desp_rent_facturata: "10890.00",
  zile_facturate: "30",
  auto_inchiriat_marca: "OPEL ASTRA",
  auto_inchiriat_clasa: "SIMILAR",
  pret_facturat: "363",
  auto_oferta_marca: "MERCEDES A",
  pret_oferta: "541.18",
  data_emitere_rca: "11/06/2026",
  tva_label: "CU TVA",

  // ---- PERIOADE ----
  data_avizare: "14/07/2026",
  data_constatare: "15/07/2026",
  rent_start: "14/07/2026",
  rent_end: "14/08/2026",
  rep_start: "14/07/2026",
  rep_end: "14/08/2026",
  culpa_periods: [],

  // ---- SCRISOARE ----
  motivare_reparatie: "cf. deviz Audatex refacut. Abuz rep adaos la piese si ora de manopera.",
  observatii: DEFAULT_OBSERVATII,
  semnatura: DEFAULT_SEMNATURA,
};

// Formular gol (start curat, fara date inventate). Pastreaza doar constante generice.
export const EMPTY_FORM = Object.keys(DEFAULT_FORM).reduce((acc, k) => {
  acc[k] = "";
  return acc;
}, {});
EMPTY_FORM.culpa_periods = [];
EMPTY_FORM.tva_percent = "21";
EMPTY_FORM.tva_label = "CU TVA";
EMPTY_FORM.status_deplasare = "NEDEPLASABIL";
EMPTY_FORM.observatii = DEFAULT_OBSERVATII;
EMPTY_FORM.semnatura = DEFAULT_SEMNATURA;

const FIXED_HOLIDAYS = [
  ["01-01", "Anul Nou"],
  ["01-02", "Anul Nou"],
  ["01-06", "Boboteaza"],
  ["01-07", "Sfantul Ioan Botezatorul"],
  ["01-24", "Unirea Principatelor Romane"],
  ["05-01", "Ziua Muncii"],
  ["06-01", "Ziua Copilului"],
  ["08-15", "Adormirea Maicii Domnului"],
  ["11-30", "Sfantul Andrei"],
  ["12-01", "Ziua Nationala a Romaniei"],
  ["12-25", "Craciunul"],
  ["12-26", "Craciunul"],
];

const formatDate = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (date, days) => {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
};

const julianGregorianOffsetDays = (year) => Math.floor(year / 100) - Math.floor(year / 400) - 2;

const addHoliday = (map, date, name) => {
  const key = formatDate(date);
  const current = map.get(key);
  if (!current) map.set(key, name);
  else if (!current.includes(name)) map.set(key, `${current} / ${name}`);
};

const orthodoxEasterGregorian = (year) => {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julianDate = new Date(Date.UTC(year, month - 1, day));
  return addDays(julianDate, julianGregorianOffsetDays(year));
};

const buildDefaultHolidays = (startYear = 2000, endYear = 2100) => {
  const map = new Map();
  for (let year = startYear; year <= endYear; year += 1) {
    FIXED_HOLIDAYS.forEach(([md, name]) => {
      const [month, day] = md.split("-");
      addHoliday(map, new Date(Date.UTC(year, Number(month) - 1, Number(day))), name);
    });

    const easter = orthodoxEasterGregorian(year);
    addHoliday(map, easter, "Paste ortodox");
    addHoliday(map, addDays(easter, 1), "Paste ortodox");
    addHoliday(map, addDays(easter, 49), "Rusalii");
    addHoliday(map, addDays(easter, 50), "Rusalii");
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
};

export const getDefaultHolidays = (years = []) => {
  const numericYears = years
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y) && y >= 1900 && y <= 2400);
  const currentYear = new Date().getUTCFullYear();
  if (!numericYears.length) {
    return buildDefaultHolidays(currentYear, currentYear);
  }
  const uniqueYears = Array.from(new Set([currentYear, ...numericYears]));
  const minYear = Math.min(...uniqueYears) - 1;
  const maxYear = Math.max(...uniqueYears) + 1;
  return buildDefaultHolidays(minYear, maxYear);
};

const HOLIDAY_KEY = "rca_holidays_v1";

export function loadHolidays(fallback = []) {
  try {
    const raw = localStorage.getItem(HOLIDAY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return fallback;
}

export function saveHolidays(list) {
  try {
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(list));
  } catch (e) {
    /* ignore */
  }
}

const FORM_KEY = "rca_form_v2";

export function loadForm() {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (raw) return { ...DEFAULT_FORM, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore */
  }
  return DEFAULT_FORM;
}

export function saveForm(form) {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(form));
  } catch (e) {
    /* ignore */
  }
}
