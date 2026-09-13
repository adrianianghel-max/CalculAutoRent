// Export date in sablonul .xlsm "Fisa de completat", 100% in browser (GDPR).
// Editam DOAR valorile celulelor mapate in XML-ul foii, pastrand macrouri, stiluri si formule.
import JSZip from "jszip";
import { calculeaza } from "@/lib/rcaCalc";

const TEMPLATE_URL = `${process.env.PUBLIC_URL || ""}/fisa_template.xlsm`;
const SHEET_PATH = "xl/worksheets/sheet1.xml"; // "Fisa de completat"

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const parseDdmmyyyy = (s) => {
  const m = (s || "").trim().match(/^(\d{2})[.\/](\d{2})[.\/](\d{4})$/);
  if (!m) return null;
  return { y: +m[3], mo: +m[2], d: +m[1] };
};

const excelSerial = (s) => {
  const p = parseDdmmyyyy(s);
  if (!p) return null;
  return (Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(1899, 11, 30)) / 86400000;
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

// Inlocuieste o celula existenta pastrand atributul de stil s="..".
function setCell(xml, ref, builder) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml; // celula lipsa in sablon -> ignoram
  const attrs = m[1] || "";
  const sMatch = attrs.match(/\ss="(\d+)"/);
  const s = sMatch ? ` s="${sMatch[1]}"` : "";
  return xml.replace(re, builder(ref, s));
}

const cellText = (val) => (ref, s) => {
  const v = val === null || val === undefined ? "" : String(val);
  if (!v) return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
};

const cellNumber = (val) => (ref, s) => {
  const n = num(val);
  if (n === null) return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s}><v>${n}</v></c>`;
};

const cellDate = (val) => (ref, s) => {
  const serial = excelSerial(val);
  if (serial === null) return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s}><v>${serial}</v></c>`;
};

// culpa_periods din form (UI) -> {label,start,end} + tip
function culpaByType(form) {
  const list = (form.culpa_periods || []).filter((p) => p.start && p.end);
  const first = (type) => list.find((p) => p.type === type);
  return {
    rec: first("reconstatare"),
    comanda: first("comanda_piese"),
    af: first("antifrauda"),
  };
}

export async function exportExcel(form, holidays) {
  // calcul proaspat pentru valorile acceptate (zile + suma)
  const culpa = (form.culpa_periods || [])
    .filter((p) => p.start && p.end)
    .map((p, idx, arr) => ({
      label: `${p.type === "comanda_piese" ? "comanda piese" : p.type === "antifrauda" ? "antifrauda" : "reconstatare"} ${
        arr.slice(0, idx + 1).filter((q) => q.type === p.type).length
      }`,
      start: p.start,
      end: p.end,
    }));
  const r = calculeaza({ ...form, culpa_periods: culpa, holidays });
  const c = culpaByType(form);

  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error("Nu am putut incarca sablonul Excel.");
  const buf = await resp.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  let xml = await zip.file(SHEET_PATH).async("string");

  const ops = [
    // ---- DATE PAGUBIT ----
    ["F2", cellText(form.nr_dosar)],
    ["D5", cellText(form.marca_model)],
    ["F5", cellText(form.status_deplasare)],
    ["D6", cellText(form.numar_inmatriculare)],
    ["D7", cellText(form.nume_pagubit)],
    ["D8", cellText(form.adresa_pagubit)],
    ["D9", cellText(form.nume_cesionar)],
    ["F9", cellText(form.cui_cesionar)],
    ["D10", cellText(form.adresa_cesionar)],
    ["D11", cellDate(form.data_eveniment)],
    ["D12", cellDate(form.data_depunere_cd)],
    // ---- FACTURA REPARATIE ----
    ["C15", cellText(form.rep_factura_nr)],
    ["D15", cellDate(form.rep_factura_data)],
    ["E15", cellText(form.rep_emitent)],
    ["F15", cellText(form.rep_localitate)],
    ["C16", cellText(form.rep_cui)],
    ["D19", cellNumber(form.ora_manopera_facturata)],
    ["E19", cellNumber(form.ora_manopera_acceptata)],
    // ---- DIFERENTE ----
    ["D22", cellNumber(form.piese_facturat)],
    ["E22", cellNumber(form.piese_acceptat)],
    ["F22", cellText(form.motivare_piese)],
    ["D23", cellNumber(form.materiale_facturat)],
    ["E23", cellNumber(form.materiale_vopsitorie_acceptat)],
    ["F23", cellText(form.motivare_materiale)],
    ["D24", cellNumber(form.ore_tinichigerie_facturat)],
    ["E24", cellNumber(form.ore_tinichigerie)],
    ["F24", cellText(form.motivare_tinichigerie)],
    ["D25", cellNumber(form.ore_vopsitorie_facturat)],
    ["E25", cellNumber(form.ore_vopsitorie)],
    ["F25", cellText(form.motivare_vopsitorie)],
    ["D26", cellNumber(form.manopera_facturat)],
    ["E26", cellNumber(form.manopera_acceptat)],
    ["F26", cellText(form.motivare_manopera)],
    ["F27", cellNumber(form.tva_percent)],
    // ---- FACTURA RENT ----
    ["C30", cellText(form.rent_factura_nr)],
    ["D30", cellDate(form.rent_factura_data)],
    ["E30", cellText(form.rent_emitent)],
    ["F30", cellText(form.rent_localitate)],
    ["C31", cellText(form.rent_cui)],
    ["D33", cellNumber(form.valoare_desp_rent_facturata)],
    ["E33", cellNumber(r.suma_rent)],
    ["D34", cellNumber(form.zile_facturate)],
    ["E34", cellNumber(r.zile_rent)],
    ["D35", cellText(form.auto_inchiriat_marca)],
    ["E35", cellText(form.auto_inchiriat_clasa)],
    ["F35", cellNumber(form.pret_facturat)],
    ["D36", cellText(form.auto_oferta_marca)],
    ["F36", cellNumber(form.pret_oferta)],
    ["D37", cellDate(form.data_emitere_rca)],
    ["F37", cellText(form.tva_label)],
    // ---- PERIOADE ----
    ["D38", cellDate(form.data_avizare)],
    ["D39", cellDate(form.rent_start)],
    ["E39", cellDate(form.rent_end)],
    ["D40", cellDate(form.rep_start)],
    ["E40", cellDate(form.rep_end)],
    ["D41", cellDate(c.rec ? c.rec.start : "")],
    ["E41", cellDate(c.rec ? c.rec.end : "")],
    ["D42", cellDate(c.comanda ? c.comanda.start : "")],
    ["E42", cellDate(c.comanda ? c.comanda.end : "")],
    ["D43", cellDate(c.af ? c.af.start : "")],
    ["E43", cellDate(c.af ? c.af.end : "")],
    ["D44", cellDate(form.data_constatare)],
  ];

  for (const [ref, builder] of ops) {
    xml = setCell(xml, ref, builder);
  }
  zip.file(SHEET_PATH, xml);

  // fortam recalcularea formulelor la deschidere (valorile cache raman altfel vechi)
  let wbxml = await zip.file("xl/workbook.xml").async("string");
  if (/<calcPr\b[^>]*\/>/.test(wbxml)) {
    wbxml = wbxml.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="0" fullCalcOnLoad="1"/>');
  } else {
    wbxml = wbxml.replace(/<\/workbook>/, '<calcPr calcId="0" fullCalcOnLoad="1"/></workbook>');
  }
  zip.file("xl/workbook.xml", wbxml);

  const out = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
  });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Fisa dosarului RCA ${form.nr_dosar || "dosar"}.xlsm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
