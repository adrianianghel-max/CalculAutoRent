export const DEFAULT_OBSERVATII =
  "Pentru reanalizarea numarului de zile de rent avem nevoie de comenzile ferme de piese si facturile de intrari piese care justifica suplimentarea numarului de zile stationate in service pana la numarul de zile facturate.\nDin documentatia trimisa pentru comanda pieselor nu rezulta concret data comenzii ferme de piese si data livrarii.";

export const DEFAULT_SEMNATURA =
  "Adrian Anghel\nInspector Daune\nGroupama Asigurari\nB-dul Marasti nr. 2, sector 1, 011467 Bucuresti, Romania\nMobil: +(4) 0748.252.361\nE-mail: adrian.anghel@groupama.ro\nwww.groupama.ro\nAlo Groupama: 0374-110-110";

export const DEFAULT_EMAIL_TO =
  "robert.fir@groupama.ro; sorin.barbu@groupama.ro; csaba.szekely@groupama.ro";

export const DEFAULT_FORM = {
  nr_dosar: "U21201993163",
  marca_pagubit: "HYUNDAI ELANTRA",
  status_deplasare: "NEDEPLASABIL",
  data_emitere_rca: "2026-06-11",

  piese_acceptat: "25614.9",
  materiale_vopsitorie_acceptat: "2409.44",
  manopera_acceptat: "4494",
  tva_percent: "21",

  ore_tinichigerie: "21.6",
  ore_vopsitorie: "10.5",

  auto_inchiriat_marca: "OPEL ASTRA",
  auto_inchiriat_clasa: "SIMILAR",
  auto_oferta_marca: "MERCEDES A",
  pret_facturat: "363",
  pret_oferta: "541.18",
  tva_label: "CU TVA",
  zile_facturate: "30",

  data_avizare: "2026-07-14",
  data_constatare: "2026-07-15",
  rent_start: "2026-07-14",
  rent_end: "2026-08-14",
  rep_start: "2026-07-14",
  rep_end: "2026-08-14",
  culpa_periods: [],

  motivare_reparatie: "cf. deviz Audatex refacut. Abuz rep adaos la piese si ora de manopera.",
  observatii: DEFAULT_OBSERVATII,
  semnatura: DEFAULT_SEMNATURA,
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

const FORM_KEY = "rca_form_v1";

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
