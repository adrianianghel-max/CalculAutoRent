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

// ---------------- OCR local (tesseract.js), model "ron" inclus offline ----------------
const OCR_SCALE = 3;
let _ocrWorker = null;
let _ocrLoading = null;

async function getOcrWorker() {
  if (_ocrWorker) return _ocrWorker;
  if (_ocrLoading) return _ocrLoading;
  _ocrLoading = (async () => {
    const { createWorker } = await import("tesseract.js");
    const base = `${process.env.PUBLIC_URL || ""}`;
    const worker = await createWorker("ron", 1, {
      workerPath: `${base}/tesseract/worker.min.js`,
      corePath: `${base}/tesseract/`,
      langPath: `${base}/tessdata`,
      gzip: true,
    });
    _ocrWorker = worker;
    return worker;
  })();
  return _ocrLoading;
}

export async function terminateOcr() {
  if (_ocrWorker) {
    try {
      await _ocrWorker.terminate();
    } catch (e) {
      /* ignore */
    }
  }
  _ocrWorker = null;
  _ocrLoading = null;
}

function bboxOf(hl) {
  const xs = [];
  const ys = [];
  if (hl.quadPoints && hl.quadPoints.length >= 8) {
    for (let q = 0; q + 7 < hl.quadPoints.length; q += 8) {
      for (let j = 0; j < 8; j += 2) {
        xs.push(hl.quadPoints[q + j]);
        ys.push(hl.quadPoints[q + j + 1]);
      }
    }
  } else if (hl.rect) {
    xs.push(hl.rect[0], hl.rect[2]);
    ys.push(hl.rect[1], hl.rect[3]);
  }
  return { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
}

function pickTextInBbox(items, b) {
  const picked = items.filter((it) => {
    const cx = (it.x0 + it.x1) / 2;
    const cy = (it.y0 + it.y1) / 2;
    return cx >= b.xmin - 2 && cx <= b.xmax + 2 && cy >= b.ymin - 2 && cy <= b.ymax + 2;
  });
  picked.sort((a, c) => (Math.abs(a.y0 - c.y0) > 3 ? c.y0 - a.y0 : a.x0 - c.x0));
  return picked.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
}

async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport };
}

async function ocrCrop(worker, pageRender, b, scale) {
  const { canvas, viewport } = pageRender;
  const left = Math.max(0, b.xmin * scale - 6);
  const right = Math.min(canvas.width, b.xmax * scale + 6);
  const top = Math.max(0, viewport.height - b.ymax * scale - 6);
  const bottom = Math.min(canvas.height, viewport.height - b.ymin * scale + 6);
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);
  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  crop.getContext("2d").drawImage(canvas, left, top, w, h, 0, 0, w, h);
  const { data } = await worker.recognize(crop);
  return (data.text || "").replace(/\s+/g, " ").trim();
}

// Extrage textul aflat SUB adnotarile de tip Highlight (marcaje galbene reale).
// Pentru PDF-uri scanate (fara strat de text), face OCR local doar pe zona marcata daca ocr=true.
export async function readHighlights(file, { ocr = false } = {}) {
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

    let pageRender = null;
    for (const hl of highlights) {
      const b = bboxOf(hl);
      let txt = pickTextInBbox(items, b);
      if (!txt && ocr) {
        const worker = await getOcrWorker();
        if (!pageRender) pageRender = await renderPage(page, OCR_SCALE);
        txt = await ocrCrop(worker, pageRender, b, OCR_SCALE);
      }
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

// Clasifica marcajele galbene: numere pure (CUI, cu/fara RO) vs text (adresa etc.).
export function classifyHighlights(highlights) {
  const cuis = [];
  const addresses = [];
  for (const raw of highlights) {
    const h = (raw || "").replace(/\s+/g, " ").trim();
    if (!h) continue;
    const compact = h.replace(/\s+/g, "");
    const cuiM = compact.match(/^(?:RO)?(\d{2,10})$/i);
    if (cuiM) {
      cuis.push(cuiM[1]);
      continue;
    }
    const letters = (h.match(/[A-Za-zĂÂÎȘȚăâîșț]/g) || []).length;
    if (letters >= 3) addresses.push(h);
  }
  return { cuis, addresses };
}

// Extrage CUI-urile (2-10 cifre) din marcajele galbene, in ordine.
export function extractCuisFromHighlights(highlights) {
  return classifyHighlights(highlights).cuis;
}
