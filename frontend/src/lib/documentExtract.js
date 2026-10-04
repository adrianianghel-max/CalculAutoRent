// Reguli locale verificabile: fără apeluri AI, telemetrie sau memorarea documentelor.
export const PDF_FIELDS = {
  nr_dosar: 'Dosar daune', numar_inmatriculare: 'Număr auto păgubit', marca_model: 'Marca / model păgubit',
  nume_pagubit: 'Nume păgubit', adresa_pagubit: 'Adresă păgubit', data_eveniment: 'Data evenimentului',
  data_avizare: 'Data avizare', data_constatare: 'Data constatării', data_emitere_rca: 'Data emitere RCA',
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
export const DOCUMENT_TYPES = { auto: 'Recunoaștere automată', rep: 'Factură reparație', rent: 'Factură Rent', contract: 'Contract Rent', comanda: 'Comandă reparație', deviz: 'Deviz / calculație finală', nc: 'Constatare', polita: 'Poliță RCA', unknown: 'Alt document' };
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
function extractRawDocument(pages, name, forcedType = 'auto') {
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
      const getNumber = pattern => { const m = norm(joined).match(new RegExp(pattern + '\\s*(?:\\((?:lei|ron|ore|h)\\)|lei|ron)?\\s*[:=]?\\s*(' + NUM + ')(?![\\d.,])', 'i')); return m && documentNumber(m[1]); };
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
        if ((m = joined.match(/factur[ăa](?:\s+fiscal[ăa])?\s*(?:seria\s*)?([A-Z][A-Z0-9-]{0,14})?\s*(?:nr\.?|num[ăa]r(?:ul)?)\s*:?\s*([A-Z0-9/-]+)/i))) add(type + '_factura_nr', [m[1],m[2]].filter(Boolean).join(' '), page.page, raw);
        if ((m = joined.match(/seri[ae]\s*:?\s*([A-Z0-9-]+)\s*(?:nr\.?|num[ăa]r(?:ul)?)\s*:?\s*([A-Z0-9/-]+)/i))) add(type + '_factura_nr', `${m[1]} ${m[2]}`, page.page, raw);
        if ((m = joined.match(/factur[ăa](?:\s+fiscal[ăa])?\s+([A-Z][A-Z0-9-]{0,12})\s+(\d{1,15})\b/i))) add(type + '_factura_nr', `${m[1]} ${m[2]}`, page.page, joined);
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
        if ((m = norm(joined).match(new RegExp('(?:tarif(?:\\s+orar)?(?:\\s+manopera)?|pret\\s+(?:ora|orar)(?:\\s+manopera)?|ora\\s+(?:de\\s+)?manopera)\\s*[:=]?\\s*(' + NUM + ')')))) add('ora_manopera_facturata',documentNumber(m[1]),page.page,raw);
        for (const [word, hours, money] of [['tinichigerie','ore_tinichigerie_facturat','rep_tin_total_document'],['vopsitorie','ore_vopsitorie_facturat','rep_vops_total_document']]) {
          if ((m = norm(joined).match(new RegExp('(?:total\\s+)?(?:manopera\\s+)?' + word + '\\s*:?\\s*(' + NUM + ')\\s*(?:ore|h)\\b')))) add(hours,documentNumber(m[1]),page.page,raw);
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
    if (r.allowedFields && !r.allowedFields.includes(r.field)) throw new Error('Câmpul nu aparține sursei autorizate.');
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
    if (r.field === 'data_avizare' || r.field === 'data_constatare') {
      for (const paired of ['data_avizare','data_constatare']) {
        if (paired in result && result[paired] !== value) throw new Error('Avizarea și constatarea trebuie să aibă aceeași dată din nc.pdf.');
        result[paired] = value;
      }
    }
  }
  return result;
}

// Sursele autoritare sunt stabilite de utilizator, independent de textul repetat.
export function isNcFile(name) { return /^nc(?:\s*\(\d+\))?\.pdf$/i.test(String(name).trim()); }
export function isPolicyFile(name) { return /^cst_nl_info_polita_2019_v2(?:\s*\(\d+\))?\.pdf$/i.test(String(name).trim()); }
const NC_FIELDS = ['nr_dosar','numar_inmatriculare','marca_model','nume_pagubit','data_eveniment','data_avizare','data_constatare','cui_cesionar','nume_cesionar','adresa_cesionar'];
const DEVIZ_FIELDS = ['piese_facturat','materiale_facturat','ora_manopera_facturata','ore_tinichigerie_facturat','ore_vopsitorie_facturat','rep_tin_total_document','rep_vops_total_document','rep_manopera_total_document','tva_percent'];
const RENT_CONTRACT_FIELDS = ['zile_facturate','auto_inchiriat_marca','rent_start','rent_end'];
const ORDER_FIELDS = ['rep_start','rep_end'];
function hasInvoiceHeading(text, name = '') {
  const n = norm(text).replace(/f\s+a\s+c\s+t\s+u\s+r\s+a/g, 'factura');
  if (/(?:^|\n)\s*(?:contract|comanda)\b/.test(n) && !/(?:^|\n)\s*factura\b/.test(n)) return false;
  return /\bfactura(?:\s+fiscala)?\b/.test(n) && /(?:nr\.?|numar|seria|cui|cod fiscal|total)/.test(n)
    || /factur/.test(norm(name)) && /(?:cui|cod fiscal)/.test(n) && /(?:total|valoare)/.test(n);
}
function sourceType(page, name, forcedType, allPages) {
  if (isNcFile(name)) return 'nc';
  if (isPolicyFile(name)) return 'polita';
  const n = norm(page.text), fn = norm(name);
  // Titlul calculației finale este mai puternic decât referințele la o factură.
  if (/calculati[ae]\s+finala|recapitulati[ae]|sumar\s+calcul/.test(n)) return 'deviz';
  if (hasInvoiceHeading(page.text, name)) {
    if (forcedType === 'rep' || forcedType === 'rent') return forcedType;
    const description = n.split(/denumirea?\s+(?:produs|servic)|descriere(?:a)?\s+(?:produs|servic)/).slice(1).join(' ') || n;
    const clean = description.replace(/comanda\s+(?:de\s+)?reparati[ei]/g, '').replace(/(?:furnizor|emitent|client|beneficiar)[^\n]*/g, '');
    const rent = /inchiriere|lipsa de folosinta|rent[ -]?a[ -]?car/.test(clean);
    const repair = /manopera|tinichigerie|vopsitorie|reparati[ei]|piese\s+(?:auto|de schimb)/.test(clean);
    if (rent && !repair) return 'rent';
    if (repair && !rent) return 'rep';
    if (/factura.*rent|cdrent/.test(fn) && !repair) return 'rent';
    if (/factura.*repar|cdrep/.test(fn) && !rent) return 'rep';
    return 'unknown';
  }
  if (/contract(?:ul)?[^\n]{0,60}(?:inchiriere|rent)/.test(n) || forcedType === 'contract' || /contract.*(?:rent|inchiriere)/.test(fn)) return 'contract';
  if (/comanda(?:\s+(?:de|ferma))?\s+reparati[ei]/.test(n) || forcedType === 'comanda' || /comanda.*repar/.test(fn)) return 'comanda';
  if (forcedType === 'deviz' || /deviz|calculatie/.test(fn) || allPages.some(p=>/calculati[ae]\s+finala|\bdeviz\b/.test(norm(p.text)))) return 'deviz';
  return 'unknown';
}
function makeCandidate(field,value,page,name,evidence,note='',allowedFields=[field]) {
  return {field,value:String(value),page:page.page,source:name,evidence:evidence.slice(0,240),note,allowedFields};
}
export function policyGivenDate(page) {
  const items=page.textItems || [], labels=[];
  for(const item of items) {
    if (/^date\s+given$/i.test(item.str.trim())) labels.push(item);
    else if (/^date$/i.test(item.str.trim())) {
      const given=items.find(it=>/^given$/i.test(it.str.trim()) && Math.abs(it.y-item.y)<3 && it.x>item.x && it.x-item.x<70);
      if(given)labels.push({...item,width:given.x+given.width-item.x});
    }
  }
  for(const label of labels) {
    const right=items.filter(it=>Math.abs(it.y-label.y)<3 && it.x>label.x+label.width+3).sort((a,b)=>a.x-b.x)[0]?.x ?? label.x+100;
    const below=items.filter(it=>it.y<label.y-2 && label.y-it.y<80 && it.x>=label.x-4 && it.x<right-2 && documentDate(it.str.trim())).sort((a,b)=>b.y-a.y);
    if(below.length)return documentDate(below[0].str.trim());
  }
  // Acceptă forma simplă, dar nu traversează alte antete de tabel.
  const direct=page.text.match(new RegExp('Date\\s+Given\\s*:?\\s*(' + DATE + ')','i'));
  return direct ? documentDate(direct[1]) : null;
}
function personKey(value) {
  return norm(value).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
}
export function ncIdentity(documents) {
  const names=documents.filter(d=>isNcFile(d.name)).flatMap(d=>extractRawDocument(d.pages,d.name,'nc').candidates.filter(c=>c.field==='nume_pagubit').map(c=>c.value));
  const unique=[...new Map(names.map(n=>[personKey(n),n])).values()];
  return unique.length===1 ? unique[0] : '';
}
function addressCandidates(page,name,identity) {
  if(!identity)return [];
  const required=personKey(identity).split(' ').filter(Boolean);
  if(required.length<2)return [];
  const matchesName=s=>{const tokens=new Set(personKey(s).split(' '));return required.every(t=>tokens.has(t));};
  const lines=page.text.split(/\n/).map(l=>l.trim()).filter(Boolean), blocks=[];
  // Facturile cu două coloane: extrage separat fiecare parte, păstrând coordonatele.
  const items=page.textItems || [];
  const partyHeaders=items.filter(it=>/^(furnizor|client|cumparator|beneficiar|emitent)\s*:?$/i.test(norm(it.str).trim())).sort((a,b)=>a.x-b.x);
  const paired=partyHeaders.length>=2 && Math.abs(partyHeaders[0].y-partyHeaders[1].y)<8;
  if(!paired && lines.some(line=>/furnizor|emitent/.test(norm(line)) && /client|cumparator|beneficiar/.test(norm(line))))return [];
  if(paired) {
    for(let h=0;h<partyHeaders.length;h++) {
      const header=partyHeaders[h],right=partyHeaders[h+1]?.x ?? Infinity;
      const part=items.filter(it=>it.x>=header.x-4 && it.x<right-4 && it.y<=header.y+3 && header.y-it.y<180).sort((a,b)=>Math.abs(a.y-b.y)>3?b.y-a.y:a.x-b.x);
      blocks.push(part.map(it=>it.str).join('\n'));
    }
  } else {
    let current=[];
    for(const line of lines) {
      if(/^(?:furnizor|client|cumparator|beneficiar|emitent)\b/.test(norm(line)) && current.length){blocks.push(current.join('\n'));current=[];}
      current.push(line);
    }
    if(current.length)blocks.push(current.join('\n'));
  }
  const out=[];
  for(const block of blocks) {
    if(!matchesName(block))continue;
    // Pentru CI/BI, numele/prenumele trebuie să fie în același bloc cu domiciliul.
    const bLines=block.split('\n');
    for(let i=0;i<bLines.length;i++) {
      if(!/\b(?:domiciliu|adresa|sediu)\b/.test(norm(bLines[i])))continue;
      if(!matchesName(bLines.slice(Math.max(0,i-10),i+2).join(' ')))continue;
      const values=[];
      let first=bLines[i].replace(/^.*?(?:domiciliu(?:l)?|adres[ăa]|sediu(?:l)?)\s*(?:\/[^:]+)?\s*:?\s*/i,'').trim();
      if(first && !/^(address|adresse)$/i.test(first))values.push(first);
      for(let j=i+1;j<Math.min(bLines.length,i+4);j++) {
        if(/^(?:cnp|cui|cif|cod fiscal|iban|cont|banca|sex|cetaten|valabil|emisa|emis|seria|nr\.?|furnizor|client|cumparator|beneficiar|nume|prenume|data)\b/.test(norm(bLines[j])))break;
        if(/jud|str\.?|strada|municip|mun\.?|oras|sat\b|com\.?|sector|nr\.?|bloc|bl\.?|scara|sc\.?|et\.?|ap\.?/i.test(bLines[j]) || !values.length)values.push(bLines[j]);else break;
      }
      const value=values.join(', ');
      if(value && !/\b\d{13}\b/.test(value))out.push(makeCandidate('adresa_pagubit',value,page,name,`${identity}\n${value}`,'Numele din nc.pdf se regăsește în blocul de adresă. Confirmă domiciliul/sediul.'));
    }
  }
  return out;
}
export function extractDocument(pages,name,forcedType='auto',context={}) {
  const candidates=[],pageTypes=[],identity=ncIdentity(context.documents || [{name,pages}]);
  const types=pages.map(p=>sourceType(p,name,forcedType,pages));
  // Ultima pagină relevantă a devizului; ignoră anexe/pagini fără valori.
  const summaryPages=pages.map((p,i)=>types[i]==='deviz' && extractRawDocument([p],name,'deviz').candidates.some(c=>DEVIZ_FIELDS.slice(0,5).includes(c.field)) ? i : -1).filter(i=>i>=0);
  const lastSummary=summaryPages.length ? summaryPages[summaryPages.length-1] : pages.length-1;
  for(let i=0;i<pages.length;i++) {
    const page=pages[i],type=sourceType(page,name,forcedType,pages);pageTypes.push(type);
    let allowed=[];
    if(type==='nc')allowed=NC_FIELDS;
    if(type==='polita')allowed=['data_emitere_rca'];
    if(type==='deviz' && i===lastSummary)allowed=DEVIZ_FIELDS;
    if(type==='contract')allowed=RENT_CONTRACT_FIELDS;
    if(type==='comanda')allowed=ORDER_FIELDS;
    if(type==='rep' || type==='rent')allowed=[`${type}_factura_nr`,`${type}_factura_data`,`${type}_cui`,`${type}_emitent`,`${type}_localitate`,type==='rent'?'valoare_desp_rent_facturata':'rep_total_document'];
    const raw=extractRawDocument([page],name,type==='contract'?'rent':type==='comanda'?'rep':type).candidates;
    for(const candidate of raw) {
      if(!allowed.includes(candidate.field) || candidate.field==='data_emitere_rca' || candidate.field==='data_avizare')continue;
      if (type==='nc' && candidate.field==='marca_model' && ncVehicleModel(page)) continue;
      candidates.push({...candidate,allowedFields:allowed});
      if(candidate.field==='data_constatare')candidates.push({...candidate,field:'data_avizare',note:'Aceeași dată a constatării din nc.pdf.',allowedFields:allowed});
    }
    if(type==='nc') { const model=ncVehicleModel(page); if(model)candidates.push(makeCandidate('marca_model',model,page,name,`Marca / Model: ${model}`)); }
    if(type==='polita') {
      const value=policyGivenDate(page);
      if(value)candidates.push(makeCandidate('data_emitere_rca',value,page,name,`Date Given: ${value}`));
    }
    if(type==='contract' || type==='comanda') {
      const prefix=type==='contract'?'rent':'rep';
      const labels=type==='contract' ? {start:'data\\s+(?:inceput|preluarii|predarii)|de\\s+la',end:'data\\s+(?:sfarsit|returnarii|restituirii)|pana\\s+la'} : {start:'data\\s+(?:intrarii|intrare|inceput)(?:\\s+(?:in\\s+service|reparatie))?',end:'data\\s+(?:iesirii|iesire|finalizarii|sfarsit)(?:\\s+(?:din\\s+service|reparatie))?'};
      for(const [part,label] of Object.entries(labels)) {
        const re=new RegExp('(?:'+label+')\\s*:?\\s*('+DATE+')','gi');
        for(const match of norm(page.text).matchAll(re)){const value=documentDate(match[1]);if(value)candidates.push(makeCandidate(prefix+'_'+part,value,page,name,match[0],'',allowed));}
      }
    }
    // Adressele sunt singura excepție: pot proveni din alte acte, cu identitate verificată.
    candidates.push(...addressCandidates(page,name,identity));
  }
  const unique=candidates.filter((c,i,arr)=>arr.findIndex(x=>x.field===c.field && x.value===c.value && x.page===c.page)===i);
  return {candidates:unique,pageTypes};
}

function ncVehicleModel(page) {
  const lines=page.text.split(/\n/);
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    const m=line.match(/\bmarca\s*(?:\/\s*model|model)?\s*[:=]\s*(.*)/i)
      || line.match(/\bmarca,?\s*tipul[^:]*:\s*(.*)/i)
      || line.match(/^\s*marca\s*(?:\/\s*model|model)?\s{2,}(.+)$/i)
      || line.match(/^\s*marca\s*\/\s*model\s*$/i);
    if(!m)continue;
    const raw=(m[1]||lines[i+1]||'').trim();
    if(/^(?:proprietar|nr\.?|numar|data|serie|vin|cnp)\b/i.test(norm(raw)))continue;
    const value=raw.split(/\t|\s{3,}|\s*\(|\s+(?:Nr\.?|Num[ăa]r|Serie|VIN|Proprietar)\b/i)[0].trim();
    if(value && value.length<100)return value.toUpperCase();
  }
  return null;
}
export function automaticPdfChanges(documents) {
  const groups=new Map(), unresolved=[];
  for(const doc of documents) {
    for(const c of extractDocument(doc.pages,doc.name,'auto',{documents}).candidates) {
      if(!c.field)continue;
      if(!groups.has(c.field))groups.set(c.field,[]);
      if (/_cui$/.test(c.field) && validCui(c.value) && new RegExp('(?:^|[^0-9])'+c.value+'(?:[^0-9]|$)').test(doc.name)) c.note = '';
      groups.get(c.field).push(c);
    }
  }
  const selected=[];
  for(const [field,items] of groups) {
    // Nu transformăm unități presupuse, CUI nevalid sau roluri incerte în valori certe.
    const safe=items.filter(c=>!/(?:posibil al clientului|nu corespunde|Unitatea nu este scrisă|nu tariful)/i.test(c.note));
    const normalized=[];
    for(const c of safe) {
      try { const validated=selectedChanges([{...c,selected:true}]); normalized.push({...c,value:validated[field],selected:true}); } catch (_) { /* valoare invalidă */ }
    }
    const values=new Set(normalized.map(c=>c.value));
    if(values.size===1)selected.push(normalized[0]);else unresolved.push(field);
  }
  // Cele două date sunt corelate; conflictele rămân pentru completare manuală.
  const dates=selected.filter(c=>['data_avizare','data_constatare'].includes(c.field));
  if(new Set(dates.map(c=>c.value)).size>1) {
    for(let i=selected.length-1;i>=0;i--)if(['data_avizare','data_constatare'].includes(selected[i].field)) { unresolved.push(selected[i].field); selected.splice(i,1); }
  }
  return {changes:selectedChanges(selected),unresolved:[...new Set(unresolved)]};
}
