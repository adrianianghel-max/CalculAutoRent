import { documentDate, documentNumber, validCui, selectedChanges, learningPages } from './documentExtract';

export const LEARNING_SECTIONS = {
  pagubit:['nr_dosar','numar_inmatriculare','marca_model','nume_pagubit','adresa_pagubit','data_eveniment','data_constatare','cui_cesionar','nume_cesionar','adresa_cesionar'],
  factura:['rep_factura_nr','rep_factura_data','rep_cui','rep_emitent','rep_localitate'],
  deviz:['piese_facturat','materiale_facturat','ora_manopera_facturata','ore_tinichigerie_facturat','ore_vopsitorie_facturat','tva_percent'],
  rent:['rent_factura_nr','rent_factura_data','rent_cui','rent_emitent','rent_localitate','valoare_desp_rent_facturata','zile_facturate','auto_inchiriat_marca','rent_start','rent_end','rep_start','rep_end','data_emitere_rca','data_avizare'],
};
const KEY='rca_pdf_layout_rules_v1';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Only these generic labels can be persisted. Never store a document excerpt, name, value or filename.
const LABELS=[
  'date given','insr begin','insr end','data constatarii','data constatare','data evenimentului','data eveniment','dosar daune','dosar de dauna','dosar',
  'numar inmatriculare','nr. inmatriculare','inmatriculare','marca / model','marca, tipul','marca','proprietar','pagubit',
  'domiciliu','adresa','sediu','cesionar','furnizor','emitent','prestator','client','cumparator','beneficiar',
  'cod fiscal','c.u.i.','cui','cif','localitate','judet','jud.',
  'factura fiscala','factura','seria','numar factura','nr. factura','data facturii','data emiterii','data factura','data',
  'total de plata','total general','total cu tva','valoare totala','total factura',
  'total piese','piese de schimb','piese','cost materiale vopsitorie','materiale vopsitorie','cost materiale','materiale',
  'tarif orar manopera','pret ora manopera','pret ora','tarif orar','tarif manopera',
  'ore tinichigerie','ore manopera tinichigerie','manopera tinichigerie','tinichigerie',
  'ore vopsitorie','ore manopera vopsitorie','manopera vopsitorie','vopsitorie','manopera','tva',
  'calculatie finala','calculatia finala','recapitulatie','deviz',
  'zile facturate','zile de inchiriere','numar zile','auto inchiriat','autoturism inchiriat','marca / nr. auto',
  'perioada rent','perioada inchiriere','perioada reparatie','data intrarii in service','data iesirii din service',
  'data intrarii','data iesirii','data preluarii','data returnarii','data restituirii','data inceput','data sfarsit','de la','pana la',
  'contract de inchiriere','comanda de reparatie','comanda reparatie',
].sort((a,b)=>b.length-a.length);
const allFields=new Set(Object.values(LEARNING_SECTIONS).flat());
const kind=field=> /^(data_|.*_factura_data$|(?:rent|rep)_(?:start|end)$)/.test(field)?'date': /cui/.test(field)?'cui': /^(piese_facturat|materiale_facturat|ora_manopera_facturata|ore_tinichigerie_facturat|ore_vopsitorie_facturat|tva_percent|zile_facturate|valoare_desp_rent_facturata)$/.test(field)?'number':'text';
function canonical(field, value) {
  const s=String(value??'').trim();
  if(!s)return null;
  if(kind(field)==='date')return documentDate(s);
  if(kind(field)==='number')return documentNumber(s);
  if(kind(field)==='cui'){const c=s.replace(/^RO\s*/i,'');return validCui(c)?c:null;}
  return norm(s).replace(/\s+/g,' ').trim();
}
function layout(page) {
  const lines=page.text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean), anchors=[];
  for(let line=0;line<lines.length;line++) {
    const text=norm(lines[line]), occupied=[];
    for(const label of LABELS) {
      let start=0,pos;
      while((pos=text.indexOf(label,start))>=0) {
        start=pos+label.length;
        if(/[a-z0-9]/.test(text[pos-1]||'') || /[a-z0-9]/.test(text[start]||''))continue;
        if(occupied.some(([a,b])=>pos<b && start>a))continue;
        occupied.push([pos,start]);anchors.push({label,line,pos,end:start});
      }
    }
  }
  anchors.sort((a,b)=>a.line-b.line||a.pos-b.pos);
  return {lines,anchors,signature:[...new Set(anchors.map(a=>a.label))].sort()};
}
function tokens(field, text) {
  if(kind(field)==='text') {
    const value=text.replace(/^\s*[:=–-]?\s*/,'').replace(/^(?:nr\.?|numar(?:ul)?)\s*:?\s*/i,'').trim();
    return value?[{value,start:0,unit:''}]:[];
  }
  const pattern=kind(field)==='date'?/\b(?:\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})\b/g:kind(field)==='cui'?/\b(?:RO\s*)?\d{2,10}\b/gi: /(?:\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[.,]\d{1,2})?/g;
  return [...text.matchAll(pattern)].map(m=>({value:m[0],start:m.index,unit:(norm(text.slice(m.index+m[0].length)).match(/^\s*(lei\/h|lei|ron|ore|h|%)(?![a-z])/i)||[])[1]||''})).filter(t=>canonical(field,t.value)!==null);
}
function relevantAnchor(field, label) {
  if(field==='data_emitere_rca')return label==='date given';
  if(['data_avizare','data_constatare'].includes(field))return ['data constatarii','data constatare'].includes(label);
  if(field==='data_eveniment')return label.startsWith('data eveniment');
  if(field==='piese_facturat')return /piese/.test(label);
  if(field==='materiale_facturat')return /materiale/.test(label);
  if(field==='ore_tinichigerie_facturat')return /tinichigerie/.test(label);
  if(field==='ore_vopsitorie_facturat')return /vopsitorie/.test(label)&&!/materiale/.test(label);
  if(field==='ora_manopera_facturata')return /tarif|pret ora/.test(label);
  if(field==='tva_percent')return label==='tva';
  if(field==='valoare_desp_rent_facturata')return /total|valoare/.test(label);
  if(field==='zile_facturate')return /zile/.test(label);
  if(field.includes('cui'))return /cui|cif|c\.u\.i|cod fiscal/.test(label);
  if(field.endsWith('_factura_nr'))return /factura|seria/.test(label)&&!label.startsWith('data');
  if(field.endsWith('_factura_data'))return label==='data'||/data.*factur|data emiterii/.test(label);
  if(field.endsWith('_emitent'))return /furnizor|emitent|prestator/.test(label);
  if(field.endsWith('_localitate'))return /localitate|jud/.test(label);
  if(field==='nume_pagubit')return /proprietar|pagubit/.test(label);
  if(field.includes('adresa'))return /adresa|sediu|domiciliu/.test(label);
  if(field==='nume_cesionar')return label==='cesionar';
  if(field==='nr_dosar')return /dosar/.test(label);
  if(field==='marca_model'||field==='auto_inchiriat_marca')return /marca|auto.*inchiriat/.test(label);
  if(field==='numar_inmatriculare')return /inmatriculare/.test(label);
  if(/_(start|end)$/.test(field))return /perioada|data|de la|pana la/.test(label);
  return false;
}
function slots(info, field, anchor) {
  const out=[];
  for(let offset=0;offset<=2;offset++) {
    const line=anchor.line+offset;if(line>=info.lines.length)break;
    // Stop at a new labelled row, except the row containing the selected label itself.
    if(offset && info.anchors.some(a=>a.line===line))break;
    const start=offset===0?anchor.end:0;
    // Don't cross into the next labelled field on the same row.
    const right=info.anchors.find(a=>a.line===line && a.pos>=start && a!==anchor)?.pos??info.lines[line].length;
    const cells=info.lines[line].slice(start,right).split('\t');
    let columnStart=start;
    cells.forEach((cell,column)=>{
      const values=tokens(field,cell);
      values.forEach((t,index)=>out.push({...t,offset,column,index,count:values.length,line,position:columnStart+t.start}));
      columnStart+=cell.length+1;
    });
  }
  return out;
}
function safeRule(rule) {
  if(!rule || !relevantAnchor(rule.field || '',rule.anchor || '') || rule.version!==1 || !allFields.has(rule.field) || !Object.hasOwn(LEARNING_SECTIONS,rule.section) || !LEARNING_SECTIONS[rule.section].includes(rule.field) || !LABELS.includes(rule.anchor) || !['nc','polita','rep','rent','contract','comanda','deviz','identity-address'].includes(rule.type))return null;
  if(!Array.isArray(rule.signature) || rule.signature.length<2 || rule.signature.length>LABELS.length || !rule.signature.every(s=>LABELS.includes(s)))return null;
  if(!['','lei/h','lei','ron','ore','h','%'].includes(rule.unit))return null;
  for(const k of ['occurrence','occurrences','offset','column','index','count'])if(!Number.isInteger(rule[k]) || rule[k]<0 || rule[k]>300)return null;
  if(rule.offset>2 || rule.occurrence>=rule.occurrences || rule.index>=rule.count)return null;
  // Explicit projection also strips unexpected properties on corrupted / old stored rules.
  return Object.fromEntries(['version','section','field','type','signature','anchor','occurrence','occurrences','offset','column','index','count','unit'].map(k=>[k,rule[k]]));
}
export function loadLearningRules(storage=globalThis.localStorage) {
  try {const values=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(values)?values.slice(-200).map(safeRule).filter(Boolean):[];}catch{return [];}
}
export function saveLearningRules(rules,storage=globalThis.localStorage) {
  const safe=rules.map(safeRule).filter(Boolean).slice(-200);storage.setItem(KEY,JSON.stringify(safe));return safe;
}
export function forgetSection(rules,section){return rules.filter(r=>r.section!==section);}
export function learnSection(section,form,baseline,documents,rules=[]) {
  const learned=[],skipped=[];let next=rules.slice();
  for(const field of LEARNING_SECTIONS[section]||[]) {
    if(!String(form[field]??'').trim() || canonical(field,form[field])===canonical(field,baseline[field]))continue;
    const expected=canonical(field,form[field]);
    if(expected===null){skipped.push({field,reason:'valoare invalidă'});continue;}
    const matches=new Map();
    for(const source of learningPages(documents,field)) {
      if(source.type==='identity-address' && !source.addresses.some(v=>canonical(field,v)===expected))continue;
      const info=layout(source.page);if(info.signature.length<2)continue;
      for(const anchor of info.anchors) {
        if(!relevantAnchor(field,anchor.label))continue;
        // These two dates are tied to the user's exact authoritative label.
        if(field==='data_emitere_rca' && anchor.label!=='date given')continue;
        if(['data_avizare','data_constatare'].includes(field) && !['data constatarii','data constatare'].includes(anchor.label))continue;
        const siblings=info.anchors.filter(a=>a.label===anchor.label);
        for(const slot of slots(info,field,anchor)) {
          if(canonical(field,slot.value)!==expected)continue;
          if(/^ore_/.test(field) && ['lei','ron','lei/h'].includes(slot.unit))continue;
          const key=[source.di,source.pi,slot.line,slot.position].join(':');
          const rule={version:1,section,field,type:source.type,signature:info.signature,anchor:anchor.label,occurrence:siblings.indexOf(anchor),occurrences:siblings.length,offset:slot.offset,column:slot.column,index:slot.index,count:slot.count,unit:slot.unit};
          const previous=matches.get(key);
          if(!previous || slot.offset<previous.rule.offset)matches.set(key,{rule,source});
        }
      }
    }
    if(matches.size!==1){skipped.push({field,reason:matches.size?'valoarea apare în mai multe locuri':'sursa nu a putut fi identificată sigur'});continue;}
    const {rule,source}=matches.values().next().value;
    next=next.filter(r=>!(r.field===field && r.type===rule.type && JSON.stringify(r.signature)===JSON.stringify(rule.signature)));
    next.push(rule);learned.push({field,source:documents[source.di].name,page:source.page.page});
  }
  return {rules:next,learned,skipped};
}
export function applyLearningRules(documents,rules=[]) {
  const groups=new Map();
  for(const input of rules) {
    const rule=safeRule(input);if(!rule)continue;
    for(const source of learningPages(documents,rule.field)) {
      if(source.type!==rule.type)continue;
      const info=layout(source.page);
      if(JSON.stringify(info.signature)!==JSON.stringify(rule.signature))continue;
      const anchors=info.anchors.filter(a=>a.label===rule.anchor);
      if(anchors.length!==rule.occurrences)continue;
      const anchor=anchors[rule.occurrence];if(!anchor)continue;
      const slot=slots(info,rule.field,anchor).find(s=>s.offset===rule.offset&&s.column===rule.column&&s.index===rule.index&&s.count===rule.count&&s.unit===rule.unit);
      if(!slot)continue;
      if(source.type==='identity-address' && !source.addresses.some(v=>canonical(rule.field,v)===canonical(rule.field,slot.value)))continue;
      try {
        const value=kind(rule.field)==='cui'?canonical(rule.field,slot.value):slot.value;
        const checked=selectedChanges([{field:rule.field,value,selected:true,allowedFields:[rule.field]}]);
        for(const [field,val] of Object.entries(checked)){if(!groups.has(field))groups.set(field,new Set());groups.get(field).add(val);}
      }catch { /* uncertain values remain for manual completion */ }
    }
  }
  const changes={},unresolved=[];
  for(const [field,values] of groups) {if(values.size===1)changes[field]=[...values][0];else unresolved.push(field);}
  if(unresolved.some(f=>['data_avizare','data_constatare'].includes(f))){delete changes.data_avizare;delete changes.data_constatare;unresolved.push('data_avizare','data_constatare');}
  return {changes,unresolved:[...new Set(unresolved)]};
}
