// Extragere text din PDF-uri, 100% in browser (GDPR - datele NU parasesc dispozitivul).
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.mjs`;

// Citeste tot textul dintr-un File PDF, concatenat pe un singur rand.
export async function readPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + " ";
  }
  return text.replace(/\s+/g, " ").trim();
}

// Extrage textul aflat SUB adnotarile de tip Highlight (marcaje galbene reale).
export async function readHighlights(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const results = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annots = await page.getAnnotations();
    const highlights = annots.filter((a) => a.subtype === "Highlight");
    if (!highlights.length) continue;
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => {
        const tx = it.transform;
        const x = tx[4];
        const y = tx[5];
        const w = it.width || 0;
        const h = it.height || Math.abs(tx[3]) || 8;
        return { str: it.str, x0: x, x1: x + w, y0: y, y1: y + h };
      });
    for (const hl of highlights) {
      // quadPoints: [x1,y1,x2,y2,x3,y3,x4,y4] pe grupuri de 8; fallback la rect
      const quads = [];
      if (hl.quadPoints && hl.quadPoints.length >= 8) {
        for (let q = 0; q + 7 < hl.quadPoints.length; q += 8) {
          const xs = [hl.quadPoints[q], hl.quadPoints[q + 2], hl.quadPoints[q + 4], hl.quadPoints[q + 6]];
          const ys = [hl.quadPoints[q + 1], hl.quadPoints[q + 3], hl.quadPoints[q + 5], hl.quadPoints[q + 7]];
          quads.push({ xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) });
        }
      } else if (hl.rect) {
        quads.push({ xmin: hl.rect[0], xmax: hl.rect[2], ymin: hl.rect[1], ymax: hl.rect[3] });
      }
      const picked = [];
      for (const it of items) {
        const cx = (it.x0 + it.x1) / 2;
        const cy = (it.y0 + it.y1) / 2;
        if (quads.some((qd) => cx >= qd.xmin - 2 && cx <= qd.xmax + 2 && cy >= qd.ymin - 2 && cy <= qd.ymax + 2)) {
          picked.push(it);
        }
      }
      picked.sort((a, b) => (Math.abs(a.y0 - b.y0) > 3 ? b.y0 - a.y0 : a.x0 - b.x0));
      const txt = picked.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
      if (txt) results.push(txt);
    }
  }
  return results;
}

function isoToRo(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}
function toIso(dmy) {
  // DD.MM.YYYY sau DD/MM/YYYY -> YYYY-MM-DD (pt. input type=date)
  const m = dmy.match(/^(\d{2})[.\/](\d{2})[.\/](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

// Extrage campurile din nc.pdf (procesul-verbal de constatare).
export function extractNc(text) {
  const out = {};
  let m;
  if ((m = text.match(/Dosar\s+daune:\s*([A-Za-z0-9\-\/]+)/i))) out.nr_dosar = m[1].trim();
  if ((m = text.match(/[ÎI]nmatriculare\s*:?\s*([A-Za-z0-9]+)/i))) out.numar_inmatriculare = m[1].trim();
  if ((m = text.match(/Marca,\s*tipul[^:]*:\s*([A-Za-z0-9][A-Za-z0-9\s\/\-]*?)\s*\(/i)))
    out.marca_model = m[1].replace(/\s+/g, " ").trim();
  if ((m = text.match(/Proprietar[^:]*:\s*(.+?)\s+Dat[ăa]?\b/i)))
    out.nume_pagubit = m[1].replace(/\s+/g, " ").trim();
  if ((m = text.match(/Data\s+evenimentului:\s*(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i))) {
    const v = isoToRo(m[1]);
    out.data_eveniment_ro = v;
    out.data_eveniment_iso = toIso(v);
  }
  if ((m = text.match(/Dat[ăa]?\s+notificare\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i)) ||
      (m = text.match(/Data\s+aviz[^\s]*\s*RCA[^0-9]*(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/i))) {
    const v = isoToRo(m[1]);
    out.data_notificare_ro = v;
    out.data_notificare_iso = toIso(v);
  }
  return out;
}

// Extrage prima data DD/MM/YYYY dupa "Date Given" din polita (data emitere RCA).
export function extractPolita(text) {
  const out = {};
  const pos = text.toLowerCase().indexOf("date given");
  if (pos >= 0) {
    const after = text.slice(pos + "date given".length, pos + "date given".length + 500);
    const m = after.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (m) {
      const v = m[1].replace(/\//g, ".");
      out.data_emitere_rca_ro = v;
      out.data_emitere_rca_iso = toIso(v);
    }
  }
  return out;
}

// Extrage CUI-urile (2-10 cifre) din marcajele galbene, in ordine.
export function extractCuisFromHighlights(highlights) {
  const cuis = [];
  for (const h of highlights) {
    const m = h.match(/\b(\d{2,10})\b/);
    if (m) cuis.push(m[1]);
  }
  return cuis;
}
