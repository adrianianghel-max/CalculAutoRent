// Local document comparison. No claims decisions and no upload of document content.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
export const OPERATIONS={INL:'Înlocuire',REP:'Reparație',VOP:'Vopsire',RV:'Revopsire',UNI:'Uniformizare',DR:'Demontare / remontare',AUX:'Operație auxiliară',UNKNOWN:'Operație neclară'};
const PARTS={ARIPA:/\bARIPA\b/,JANTA:/\bJANT[AE]\b/,BARA:/\bBARA\b/,FAR:/\bFAR(?:URI)?\b/,USA:/\bUS[AI]\b/,CAPOTA:/\bCAPOTA\b/,HAION:/\bHAION\b/,PORTBAGAJ:/\bPORTBAGAJ\b/,OGLINDA:/\bOGL(?:INDA)?\b/,PARBRIZ:/\bPARBRIZ\b/,LUNETA:/\bLUNETA\b/,PLAFON:/\bPLAFON\b/,PRAG:/\bPRAG\b/,STOP:/\bSTOP\b/,ANVELOPA:/\bANVELOPA\b/,ROATA:/\bROATA\b/,CARENAJ:/\bCARENAJ(?:E)?\b/,SCUT:/\bSCUT\b/};
const KEY='rca_repair_audit_rules_v1';
function descriptor(text){const n=norm(text),part=Object.keys(PARTS).find(k=>PARTS[k].test(n))||'';return {part,side:/\b(?:DREAPTA|DRT|DR)\b/.test(n)?'DR':/\b(?:STANGA|STG|ST)\b/.test(n)?'ST':'',position:/\b(?:FATA|F)\b/.test(n)?'F':/\b(?:SPATE|SP)\b/.test(n)?'SP':''};}
function compatible(a,b){return !(a.side&&b.side&&a.side!==b.side)&&!(a.position&&b.position&&a.position!==b.position);}
function operation(text){const n=norm(text);if(/\bINLOCUIRE\b|\bINL\b/.test(n))return 'INL';if(/\bD\s*\/\s*R\b|DEMONT|REMONT/.test(n))return 'DR';if(/CONSERVARE|REGLARE|PREGATIRE|GFS|DIAGNO|ECHILIBRARE|ADEZ|CONSTANTA/.test(n))return 'AUX';if(/REVOPS/.test(n))return 'RV';if(/VOPSIRE/.test(n))return 'VOP';if(/REPARAT/.test(n))return 'REP';return 'UNKNOWN';}
function row(text,page,doc,extra){return {id:`${doc}:${page.page}:${extra.line}`,text:text.trim(),page:page.page,source:doc,ocr:/OCR/i.test(page.method||''),box:page.lineBoxes?.[extra.line]||null,...descriptor(text),...extra};}
export function extractNcItems(doc){const items=[];for(const page of doc.pages){let active=false;const lines=page.text.split(/\n/);for(let i=0;i<lines.length;i++){const text=norm(lines[i]);if(/SOLUTII TEHNICE|DESCRIERE AVARIE/.test(text))active=true;if(active&&/^(?:INL\s*-|MENTIUNI|OBSERVATII SPECIALIST|DOCUMENTE NECESARE)/.test(text))active=false;if(!active)continue;const m=text.match(/^\s*(\d{1,3})\s+(\d{3,5})\s+(.+?)\s+(INL|REP|VOP|RV|UNI)\b/);if(m)items.push(row(m[3],page,doc.name,{line:i,positionNumber:m[1],code:m[2],operation:m[4]}));}}
return items;}
export function extractDevizItems(doc){const items=[];for(const page of doc.pages){const lines=page.text.split(/\n/);let mode='';for(let i=0;i<lines.length;i++){const raw=lines[i],text=norm(raw),compact=text.replace(/\s/g,'');
 if(/CONTROL.?-?INFORMAT|CALCULATIEFINALA|PAGINACUPRINS|JURNAL/.test(compact)){mode='';continue;}
 if(/BAZAMANOPERA|COD.*DETALII/.test(compact))mode='labor';
 if(/^VOPSITORIE(?:\(|$)/.test(compact))mode='paint';
 if(/^PIESE(?:PRET|$)/.test(compact)||/NR\.?GHID.*DESCRIERE/.test(compact))mode='parts';
 if(!mode||/^(?:INCLUDE|NU INCLUDE|\(|TOTAL|COST |PRET |BAZA |NUMAR |SISTEM |PAGINA)/.test(text))continue;
 const part=descriptor(text).part;
 const special=/CONSERVARE|REGLARE|EFECTUARE FUNCTIE GFS|PREGATIRE.*(?:CULOARE|VOPSIRE)|CONSTANTA MATERIAL/.test(text);
 if(!part&&!special)continue;
 let code='',op=operation(text),label=raw,quantity=null;
 if(mode==='parts'||mode==='paint'){
  const m=text.match(/^(\d{4})\s+(?:(\d+(?:[.,]\d+)?)\s+)?(.+)/);if(!m) {if(!special)continue;}else {code=m[1];label=m[3];quantity=m[2]||null;}
  if(mode==='parts')op=/ADEZ|SET |CLIPS|SURUB/.test(text)?'AUX':'INL';
  if(mode==='paint')op='VOP';
 }else if(op==='UNKNOWN'&&!special)continue;
 if(special)op='AUX';
 items.push(row(label,page,doc.name,{line:i,code,operation:op,quantity,category:mode,text:raw.trim()}));
 }}return items;}
function docIdentity(doc){const text=norm(doc.pages.map(p=>p.text).join('\n'));const cases=[...text.matchAll(/(?:NUMAR DOSAR(?: DE DAUNA)?|DOSAR DAUNE|NR\.? DOSAR)\s*[:"]*\s*([A-Z]{0,8}\d{7,20})/g)].map(m=>m[1]);const unique=[...new Set(cases)];return unique.filter(id=>!/^\d+$/.test(id)||!unique.some(other=>other!==id&&/^[A-Z]+/.test(other)&&other.replace(/^[A-Z]+/,'')===id));}
function safeRule(r){if(!r||r.version!==1||!['match','reject'].includes(r.decision)||!/^\d{3,5}$/.test(r.ncCode)||!/^\d{3,5}$/.test(r.devizCode)||!PARTS[r.part]||!['','DR','ST'].includes(r.side)||!['','F','SP'].includes(r.position))return null;return {version:1,ncCode:r.ncCode,devizCode:r.devizCode,part:r.part,side:r.side,position:r.position,decision:r.decision};}
export function loadAuditRules(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r.map(safeRule).filter(Boolean).slice(-200):[];}catch{return [];}}
export function saveAuditRule(rules,nc,item,decision){if(!nc.part||!item.part||nc.part!==item.part||!compatible(nc,item))throw Error('Poți memora doar elemente de același tip, fără contradicții stânga/dreapta sau față/spate.');const rule=safeRule({version:1,ncCode:nc.code,devizCode:item.code,part:nc.part,side:nc.side,position:nc.position,decision});if(!rule)throw Error('Pentru învățare sunt necesare codurile de reper din ambele documente. Această asociere poate fi verificată doar manual.');const next=rules.filter(r=>!(r.ncCode===rule.ncCode&&r.devizCode===rule.devizCode&&r.part===rule.part&&r.side===rule.side&&r.position===rule.position));next.push(rule);localStorage.setItem(KEY,JSON.stringify(next.slice(-200)));return next;}
export function clearAuditRules(){localStorage.removeItem(KEY);}
export function compareRepair(ncDoc,devizDoc,rules=[]){const nc=extractNcItems(ncDoc),deviz=extractDevizItems(devizDoc);const warnings=[];
 const nids=docIdentity(ncDoc),dids=docIdentity(devizDoc);
 const mismatch=nids.length>1||dids.length>1||(nids.length===1&&dids.length===1&&nids[0]!==dids[0]);
 if(mismatch)warnings.push('Numerele de dosar sunt diferite sau contradictorii. Selectează documentele aceluiași caz înainte de corelare.');
 if(!nids.length||!dids.length)warnings.push('Nu am putut confirma numărul dosarului în ambele documente. Verifică identitatea vehiculului și a cazului.');
 if(!nc.length)warnings.push('Nu am recunoscut tabelul soluțiilor tehnice din NC. Rezultatul este incomplet; verifică manual documentul.');
 if(!deviz.length)warnings.push('Nu am recunoscut pozițiile devizului. Rezultatul este incomplet; încearcă documentul original sau o scanare mai clară.');
 if([...ncDoc.pages,...devizDoc.pages].some(p=>/OCR/.test(p.method||'')||p.warning))warnings.push('Au fost folosite pagini scanate/OCR. Codurile, cantitățile și adnotările trebuie verificate pe document.');
 const used=new Set();
 const rows=nc.map(n=>{const matches=[];const conflicts=[];
  if(!mismatch)for(const d of deviz){const rule=rules.map(safeRule).filter(Boolean).find(r=>r.ncCode===n.code&&r.devizCode===d.code&&r.part===n.part&&r.part===d.part&&r.side===n.side&&r.position===n.position);if(rule?.decision==='reject')continue;
   const sameCode=n.code&&n.code===d.code;const samePart=n.part&&n.part===d.part;
   if(!compatible(n,d)){if(sameCode||samePart)conflicts.push(d);continue;}
   if(sameCode&&n.part&&d.part&&n.part!==d.part){conflicts.push(d);continue;}
   const fullSide=(!n.side||n.side===d.side)&&(!n.position||n.position===d.position);
   if(sameCode||(samePart&&fullSide)||rule?.decision==='match'){matches.push({...d,reason:rule?.decision==='match'?'Asociere confirmată anterior':sameCode?'Același cod de reper':'Denumire și poziție concordante'});used.add(d.id);}
  }
  const primary=matches.filter(d=>d.operation!=='AUX');
  const correct=primary.some(d=>d.operation===n.operation||(n.operation==='RV'&&d.operation==='VOP'));
  return {nc:n,matches,conflicts,status:mismatch?'blocked':!primary.length?'missing':correct?'found':'operation',message:mismatch?'Corelare oprită: dosare diferite':!primary.length?'Nu a fost identificat sigur în pozițiile citite':correct?'Element și operație regăsite; verifică dovada':'Element regăsit, dar operația cerută nu este confirmată'};
 });
 return {rows,extras:deviz.filter(d=>!used.has(d.id)),deviz,warnings,blocked:mismatch};}
