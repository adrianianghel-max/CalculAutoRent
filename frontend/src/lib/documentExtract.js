// Reguli locale verificabile: fără apeluri AI, telemetrie sau memorarea documentelor.
export const PDF_FIELDS = {
  nr_dosar: 'Dosar daune', numar_inmatriculare: 'Număr auto păgubit', marca_model: 'Marca / model păgubit',
  nume_pagubit: 'Nume păgubit', adresa_pagubit: 'Adresă păgubit', data_eveniment: 'Data evenimentului',
  data_avizare: 'Data avizare / DIR', data_constatare: 'Data constatării', data_emitere_rca: 'Data emitere RCA',
  rep_factura_nr: 'Reparație • serie și număr factură', rep_factura_data: 'Reparație • data facturii',
  rep_cui: 'Reparație • CUI emitent', rep_emitent: 'Reparație • emitent', rep_localitate: 'Reparație • localitate / județ',
  rent_factura_nr: 'Rent • serie și număr factură', rent_factura_data: 'Rent • data facturii',
  rent_cui: 'Rent • CUI emitent', rent_emitent: 'Rent • emitent', rent_localitate: 'Rent • localitate / județ',
  valoare_desp_rent_facturata: 'Rent • total factură (lei)', zile_facturate: 'Rent • zile facturate',
  auto_inchiriat_marca: 'Rent • marca / număr auto', rent_start: 'Rent • început', rent_end: 'Rent • sfârșit',
  rep_start: 'Reparație • început', rep_end: 'Reparație • sfârșit',
  piese_facturat: 'Deviz • total piese (lei)', materiale_facturat: 'Deviz • materiale vopsitorie (lei)',
  ora_manopera_facturata: 'Deviz • tarif manoperă (lei/h)', ore_tinichigerie_facturat: 'Deviz • ore tinichigerie',
  ore_vopsitorie_facturat: 'Deviz • ore vopsitorie', tva_percent: 'Reparație • TVA (%)',
  rep_total_document: 'Document • total reparație cu TVA (lei)', rep_tin_total_document: 'Document • total manoperă tinichigerie (lei)',
  rep_vops_total_document: 'Document • total manoperă vopsitorie (lei)', rep_manopera_total_document: 'Document • total manoperă (lei)',
  cui_cesionar: 'CUI cesionar', nume_cesionar: 'Nume cesionar', adresa_cesionar: 'Adresă cesionar',
};
export const DOCUMENT_TYPES = { auto: 'Recunoaștere automată', rep: 'Factură reparație', rent: 'Factură / contract Rent', deviz: 'Deviz / calculație finală', nc: 'Constatare', polita: 'Poliță RCA', unknown: 'Alt document' };
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const DATE = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{2}[./]\\d{2}[./]\\d{4})';
const NUM = '-?(?:\\d{1,3}(?:[ .,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
export function documentNumber(raw) {
  let s = String(raw).replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s); return Number.isFinite(n) && n >= 0 ? String(n) : null;
}
export function documentDate(raw) {
  const m = String(raw).match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})[./](\d{2})[./](\d{4}))$/);
  if (!m) return null;
  const [y, mo, d] = m[1] ? [+m[1], +m[2], +m[3]] : [+m[6], +m[5], +m[4]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return y > 1900 && dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}` : null;
}
export function validCui(value) {
  const s = String(value).replace(/^RO/i, '');
  if (!/^\d{2,10}$/.test(s)) return false;
  const digits = s.padStart(10, '0').split('').map(Number), key = '753217532';
  const sum = digits.slice(0, 9).reduce((a, v, i) => a + v * Number(key[i]), 0);
  return ((sum * 10) % 11) % 10 === digits[9];
}
export function detectDocument(text, name = '') {
  const n = norm(text), fn = norm(name);
  if (/calculatie\s+finala|recapitulatie\s+(?:deviz|calculatie)/.test(n)) return 'deviz';
  if (/\bfactur[ae]\b/.test(n)) {
    const rent = /inchiriere|rent[ -]?a[ -]?car|lipsa de folosinta/.test(n), rep = /reparati[ei]|tinichigerie|vopsitorie/.test(n);
    if (rent && !rep) return 'rent';
    if (rep && !rent) return 'rep';
    return 'unknown';
  }
  if (/date given|polita.*rca/.test(n)) return 'polita';
  if (/proces.verbal.*constatare|data avizarii|data evenimentului/.test(n)) return 'nc';
  if (/deviz|calculatie/.test(n)) return 'deviz';
  if (/contract.*inchiriere/.test(n)) return 'rent';
  if (/rent|cdrent/.test(fn)) return 'rent';
  if (/deviz|calculatie/.test(fn)) return 'deviz';
  if (/repar|cdrep/.test(fn)) return 'rep';
  return 'unknown';
}
export function extractDocument(pages, name, forcedType = 'auto') {
  const candidates = [], pageTypes = [];
  const add = (field, value, page, evidence, note = '') => {
    if (value === null || value === undefined || String(value).trim() === '') return;
    const v = String(value).trim();
    if (!candidates.some(c => c.field === field && c.value === v && c.page === page)) candidates.push({ field, value: v, page, source: name, evidence: evidence.trim().slice(0, 240), note });
  };
  let previous = 'unknown';
  for (const page of pages) {
    const detected = detectDocument(page.text, name);
    const type = forcedType === 'auto' ? (detected === 'unknown' && !/factur/i.test(page.text) ? previous : detected) : forcedType;
    previous = type; pageTypes.push(type);
    const lines = page.text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let supplier = false, buyer = false;
    const finalIndex = lines.findIndex(l => /calculatie\s+finala/i.test(norm(l)));
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i], n = norm(raw), next = lines[i + 1] || '';
      const joined = raw + '\n' + next;
      const getDate = pattern => { const m = norm(joined).match(new RegExp(pattern + '[^\\d\\n]{0,30}\\s*(' + DATE + ')', 'i')); return m && documentDate(m[1]); };
      const getNumber = pattern => { const m = n.match(new RegExp(pattern + '\\s*[:=]?\\s*(' + NUM + ')(?![\\d.,])', 'i')); return m && documentNumber(m[1]); };
      let m;
      if ((m = n.match(/dosar(?:\s+(?:de\s+)?daun[ae])?\s*(?:nr\.?\s*)?[:#]\s*([a-z0-9/-]+)/i))) add('nr_dosar', m[1].toUpperCase(), page.page, raw);
      if (type === 'nc') {
        if ((m = raw.match(/(?:[îi]nmatriculare|num[ăa]r auto)\s*:?\s*([A-Z]{1,2}\s*\d{2,3}\s*[A-Z]{3})\b/i))) add('numar_inmatriculare', m[1].replace(/\s/g, '').toUpperCase(), page.page, raw);
        if ((m = raw.match(/(?:marca(?:,?\s*tipul[^:]*)?|marca\s*\/\s*model)\s*:\s*([^\t:(]+?)(?=\t|\s{3,}|$)/i))) add('marca_model', m[1], page.page, raw);
        if ((m = raw.match(/proprietar[^:]*:\s*([^\t]+?)(?=\t|\s{3,}|$)/i))) add('nume_pagubit', m[1], page.page, raw);
        add('data_eveniment', getDate('data\\s+evenimentului'), page.page, joined);
        add('data_avizare', getDate('data\\s+(?:avizarii(?:\\s+rca)?|notificare|avizare(?:\\s+rca)?)'), page.page, joined);
        add('data_constatare', getDate('data\\s+constatarii'), page.page, joined);
      }
      if (type === 'polita') add('data_emitere_rca', getDate('(?:date\\s+given|data\\s+emiterii|data\\s+emitere(?:\\s+rca)?)'), page.page, joined);
      if (type === 'rep' || type === 'rent') {
        if (/\b(?:furnizor|emitent|prestator)\b/.test(n)) { supplier = true; buyer = false; }
        if (/\b(?:cumparator|beneficiar|client)\b/.test(n) && !/\b(?:furnizor|emitent|prestator)\b/.test(n)) { supplier = false; buyer = true; }
        if ((m = raw.match(/(?:furnizor|emitent|prestator)\s*:\s*([^\t]+?)(?=\t|\s{3,}|$)/i))) add(type + '_emitent', m[1], page.page, raw);
        const cuiMatches = [...raw.matchAll(/(?:C\.?U\.?I\.?|C\.?I\.?F\.?|cod\s+fiscal)\s*:?\s*(?:RO\s*)?(\d{2,10})\b/gi)];
        if (!buyer) for (const cm of cuiMatches) add(type + '_cui', cm[1], page.page, raw, (!supplier || cuiMatches.length > 1 ? 'Verifică emitentul: CUI posibil al clientului. ' : '') + (!validCui(cm[1]) ? 'Cifra de control CUI nu corespunde; verifică OCR-ul.' : ''));
        if (supplier && (m = raw.match(/(?:localitate|jude[tț](?:ul)?|jud\.)\s*:?\s*([^,\t;]+)/i))) add(type + '_localitate', m[1], page.page, raw);
        if ((m = raw.match(/factur[ăa](?:\s+fiscal[ăa])?\s*(?:seria\s*)?([A-Z][A-Z0-9-]{0,14})?\s*(?:nr\.?|num[ăa]r(?:ul)?)\s*:?\s*([A-Z0-9/-]+)/i))) add(type + '_factura_nr', [m[1],m[2]].filter(Boolean).join(' '), page.page, raw);
        if ((m = joined.match(/seria\s*:?\s*([A-Z0-9-]+)\s*(?:nr\.?|num[ăa]r(?:ul)?)\s*:?\s*([A-Z0-9/-]+)/i))) add(type + '_factura_nr', `${m[1]} ${m[2]}`, page.page, raw);
        if (i < 25 && /^data\s*:/i.test(n)) add(type + '_factura_data', getDate('^data'), page.page, joined);
        add(type + '_factura_data', getDate('data\\s+(?:facturii|factura|emiterii|emiter[eii]+)'), page.page, joined);
        const total = getNumber('(?:total\\s+(?:de\\s+plata|general|cu\\s+tva)|valoare\\s+totala(?:\\s+cu\\s+tva)?)');
        add(type === 'rent' ? 'valoare_desp_rent_facturata' : 'rep_total_document', total, page.page, raw);
        if (type === 'rent') {
          add('zile_facturate', getNumber('(?:numar(?:ul)?\\s+(?:de\\s+)?zile|zile\\s+(?:facturate|de\\s+inchiriere))'), page.page, raw);
          if ((m = n.match(new RegExp('(' + NUM + ')\\s*zile?\\s*(?:inchiriere|rent)')))) add('zile_facturate', documentNumber(m[1]), page.page, raw);
          if ((m = raw.match(/(?:auto(?:turism)?\s+[îi]nchiriat|marca\s*\/\s*nr\.?\s*auto)\s*:\s*([^\t]+)/i))) add('auto_inchiriat_marca',m[1],page.page,raw);
        }
      }
      if (type === 'rent' || type === 'rep' || type === 'deviz') {
        if ((m = n.match(new RegExp('perioada\\s+(inchiriere|rent|reparatie|reparatii)\\s*:?\\s*(' + DATE + ')\\s*(?:-|–|pana la|la)\\s*(' + DATE + ')')))) {
          const prefix = /rent|inchiriere/.test(m[1]) ? 'rent' : 'rep';
          add(prefix + '_start', documentDate(m[2]), page.page, raw); add(prefix + '_end', documentDate(m[3]), page.page, raw);
        }
      }
      if ((type === 'deviz' && (finalIndex < 0 || i >= finalIndex)) || type === 'rep') {
        add('piese_facturat',getNumber('(?:total\\s+piese(?:\\s+de\\s+schimb)?|piese\\s+de\\s+schimb\\s+total)'),page.page,raw);
        add('materiale_facturat',getNumber('(?:cost(?:uri)?\\s+materiale(?:\\s+(?:de\\s+)?vopsitorie)?|total\\s+materiale(?:\\s+(?:de\\s+)?vopsitorie)?)'),page.page,raw);
        if ((m = n.match(new RegExp('(?:tarif(?:\\s+orar)?(?:\\s+manopera)?|pret\\s+(?:ora|orar)(?:\\s+manopera)?|ora\\s+(?:de\\s+)?manopera)\\s*[:=]?\\s*(' + NUM + ')')))) add('ora_manopera_facturata',documentNumber(m[1]),page.page,raw);
        for (const [word, hours, money] of [['tinichigerie','ore_tinichigerie_facturat','rep_tin_total_document'],['vopsitorie','ore_vopsitorie_facturat','rep_vops_total_document']]) {
          if ((m = n.match(new RegExp('(?:total\\s+)?(?:manopera\\s+)?' + word + '\\s*:?\\s*(' + NUM + ')\\s*(?:ore|h)\\b')))) add(hours,documentNumber(m[1]),page.page,raw);
          if ((m = n.match(new RegExp('^total\\s+manopera\\s+' + word + '\\s*:?\\s*(' + NUM + ')\\s*$')))) add(money,documentNumber(m[1]),page.page,raw,'Unitatea nu este scrisă: confirmă că totalul este în lei.');
          add(hours,getNumber('(?:total\\s+)?ore\\s+(?:de\\s+)?(?:manopera\\s+)?' + word),page.page,raw);
          if ((m = n.match(new RegExp('(?:total\\s+)?manopera\\s+' + word + '\\s*:?\\s*(' + NUM + ')\\s*(?:lei|ron)\\b')))) add(money,documentNumber(m[1]),page.page,raw);
          if (n.includes(word) && (m = n.match(new RegExp('(' + NUM + ')\\s*(?:ore|h)\\b.*?(' + NUM + ')\\s*(?:lei|ron)\\s*$')))) { add(hours,documentNumber(m[1]),page.page,raw); add(money,documentNumber(m[2]),page.page,raw,'Verifică dacă suma este totalul rândului, nu tariful orar.'); }
        }
        add('rep_manopera_total_document',getNumber('total\\s+manopera(?!\\s+(?:tinichigerie|vopsitorie))'),page.page,raw);
        if ((m = n.match(/\btva\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/))) add('tva_percent',documentNumber(m[1]),page.page,raw);
      }
    }
    for (const hl of page.highlights || []) add('', hl, page.page, hl, 'Marcaj PDF: alege explicit câmpul de destinație.');
  }
  return { candidates, pageTypes };
}
export function candidateConflict(candidate, all) {
  return Boolean(candidate.field && all.some(c => c.field === candidate.field && c.value !== candidate.value));
}
export function selectedChanges(rows) {
  const result = {};
  for (const r of rows.filter(r => r.selected)) {
    if (!PDF_FIELDS[r.field] || !String(r.value).trim()) throw new Error('Alege câmpul și valoarea pentru fiecare rând bifat.');
    let value = r.value.trim();
    if (/^(?:piese_facturat|materiale_facturat|ora_manopera_facturata|ore_tinichigerie_facturat|ore_vopsitorie_facturat|tva_percent|zile_facturate|valoare_desp_rent_facturata|rep_.*_document)$/.test(r.field)) {
      value = documentNumber(value);
      if (value === null) throw new Error('Valoare numerică invalidă pentru ' + PDF_FIELDS[r.field]);
      if (r.field === 'tva_percent' && Number(value) > 100) throw new Error('TVA trebuie să fie între 0 și 100%.');
    }
    if (/^(?:data_|.*_factura_data$|(?:rent|rep)_(?:start|end)$)/.test(r.field)) {
      value = documentDate(value);
      if (!value) throw new Error('Dată invalidă pentru ' + PDF_FIELDS[r.field]);
    }
    if (r.field in result && result[r.field] !== value) throw new Error('Ai bifat valori diferite pentru același câmp. Păstrează o singură variantă.');
    result[r.field] = value;
  }
  return result;
}
