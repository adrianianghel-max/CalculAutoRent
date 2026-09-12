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
