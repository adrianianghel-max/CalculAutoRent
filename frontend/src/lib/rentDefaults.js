export const DEFAULT_OBSERVATII =
  "Pentru reanalizarea numarului de zile de rent avem nevoie de comenzile ferme de piese si facturile de intrari piese care justifica suplimentarea numarului de zile stationate in service pana la numarul de zile facturate.\nDin documentatia trimisa pentru comanda pieselor nu rezulta concret data comenzii ferme de piese si data livrarii.";

export const DEFAULT_SEMNATURA = "";
export const DEFAULT_EMAIL_TO = "";

export const DEFAULT_FORM = {
  // ---- DATE PAGUBIT ----
  nr_dosar: "",
  marca_model: "",
  numar_inmatriculare: "",
  nume_pagubit: "",
  adresa_pagubit: "",
  nume_cesionar: "",
  cui_cesionar: "",
  adresa_cesionar: "",
  data_eveniment: "",
  data_depunere_cd: "",
  status_deplasare: "",

  rep_total_document: "",
  rep_tin_total_document: "",
  rep_vops_total_document: "",
  rep_manopera_total_document: "",

  // ---- DATE FACTURA REPARATIE ----
  rep_factura_nr: "",
  rep_factura_data: "",
  rep_emitent: "",
  rep_cui: "",
  rep_localitate: "",
  valoare_desp_rep_facturata: "",
  ora_manopera_facturata: "",
  ora_manopera_acceptata: "",

  // ---- DIFERENTE DESPAGUBIRE REPARATIE (facturat vs acceptat) ----
  piese_facturat: "",
  piese_acceptat: "",
  materiale_facturat: "",
  materiale_vopsitorie_acceptat: "",
  ore_tinichigerie_facturat: "",
  ore_tinichigerie: "",
  ore_vopsitorie_facturat: "",
  ore_vopsitorie: "",
  manopera_facturat: "",
  manopera_acceptat: "",
  tva_percent: "",
  motivare_piese: "",
  motivare_materiale: "",
  motivare_tinichigerie: "",
  motivare_vopsitorie: "",
  motivare_manopera: "",

  // ---- DATE FACTURA LIPSA DE FOLOSINTA (RENT) ----
  rent_factura_nr: "",
  rent_factura_data: "",
  rent_emitent: "",
  rent_cui: "",
  rent_localitate: "",
  valoare_desp_rent_facturata: "",
  zile_facturate: "",
  auto_inchiriat_marca: "",
  auto_inchiriat_clasa: "",
  pret_facturat: "",
  auto_oferta_marca: "",
  pret_oferta: "",
  data_emitere_rca: "",
  tva_label: "",

  // ---- PERIOADE ----
  data_avizare: "",
  data_constatare: "",
  rent_start: "",
  rent_end: "",
  rep_start: "",
  rep_end: "",
  culpa_periods: [],

  // ---- SCRISOARE ----
  motivare_reparatie: "",
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

// Datele dosarului rămân doar în starea aplicației, fără persistență automată.
export function loadForm() {
  return { ...EMPTY_FORM, culpa_periods: [] };
}

export function saveForm() {
  try { localStorage.removeItem(FORM_KEY); } catch (_) { /* stocare indisponibilă */ }
}
