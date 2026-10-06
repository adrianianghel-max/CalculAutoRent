import {documentNumber} from './documentExtract';
export const BRANDS=['ALFA ROMEO','AUDI','BMW','CHEVROLET','CITROEN','DACIA','FIAT','FORD','HONDA','HYUNDAI','JAGUAR','JEEP','KIA','LAND ROVER','LEXUS','MAZDA','MERCEDES','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','SEAT','SKODA','SMART','SUBARU','SUZUKI','TESLA','TOYOTA','VOLKSWAGEN','VOLVO'];
export const REGIONS=['ALBA','ARAD','ARGES','BACAU','BIHOR','BISTRITA NASAUD','BOTOSANI','BRAILA','BRASOV','BUCURESTI','BUZAU','CALARASI','CARAS SEVERIN','CLUJ','CONSTANTA','COVASNA','DAMBOVITA','DOLJ','GALATI','GIURGIU','GORJ','HARGHITA','HUNEDOARA','IALOMITA','IASI','ILFOV','MARAMURES','MEHEDINTI','MURES','NEAMT','OLT','PRAHOVA','SALAJ','SATU MARE','SIBIU','SUCEAVA','TELEORMAN','TIMIS','TULCEA','VALCEA','VASLUI','VRANCEA'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const N='([0-9]+(?:[.,][0-9]+)?)';
const KEY='rca_correction_profiles_v1';
export function readManualCorrections(doc){
 const candidates=[];
 for(const page of doc?.pages||[]){
  // Embedded overlay text is preferred to OCR, which may merge old and corrected amounts.
  const texts=[page.nativeText,page.text].filter(Boolean);
  for(const text of texts){const n=norm(text),values={},evidence=[];
   for(const [term,field] of [['TINICHIGERIE','ore_tinichigerie'],['VOPSITORIE','ore_vopsitorie']]){
    const re=new RegExp('MANOPERA\\s+'+term+'\\s+CF\\.?\\s+REPARATOR\\s+'+N+'\\s*H\\s*[X×*]\\s*'+N+'\\s*LEI\\s*/\\s*H[^\\n]*','g');
    for(const m of n.matchAll(re)){values[field]=documentNumber(m[1]);const rate=documentNumber(m[2]);if(values.ora_manopera_acceptata&&values.ora_manopera_acceptata!==rate)values.conflict=true;values.ora_manopera_acceptata=rate;evidence.push({page:page.page,text:m[0],field});}
   }
   for(const [pattern,field] of [['MATERIALE\\s+VOPSITORIE\\s+CF\\.?\\s+REPARATOR\\s+','materiale_vopsitorie_acceptat'],['PIESE\\s*\\+\\s*2\\s*%\\s*CF\\.?\\s+REPARATOR\\s+','piese_acceptat']]){const m=n.match(new RegExp(pattern+N));if(m){values[field]=documentNumber(m[1]);evidence.push({page:page.page,text:m[0],field});}}
   if(Object.keys(values).length){const context=n.match(/PENTRU\s+([A-Z ]+?)\s+REGIUNEA\s+([A-Z ]+?)\s*=/);const brand=context?.[1]?.trim(),region=context?.[2]?.trim();candidates.push({values,evidence,brand:BRANDS.includes(brand)?brand:'',region:REGIONS.includes(region)?region:''});break;}
  }
 }
 const values={},evidence=[],conflicts=new Set();let brand='',region='';
 for(const c of candidates){for(const [field,value] of Object.entries(c.values)){if(field==='conflict'){conflicts.add('ora_manopera_acceptata');continue;}if(values[field]!==undefined&&values[field]!==value)conflicts.add(field);values[field]=value;}evidence.push(...c.evidence);brand=brand||c.brand;region=region||c.region;}
 for(const field of conflicts)delete values[field];
 return {values,evidence,brand,region,conflicts:[...conflicts]};
}
function validProfile(p){return p&&p.version===1&&BRANDS.includes(p.brand)&&REGIONS.includes(p.region)&&Number.isFinite(p.rate)&&p.rate>0&&p.rate<=10000&&/^\d{4}-\d{2}-\d{2}$/.test(p.checkedOn)&&p.method==='current-document-hours';}
export function loadCorrectionProfiles(){try{const list=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(list)?list.filter(validProfile).map(({version,brand,region,rate,checkedOn,method})=>({version,brand,region,rate,checkedOn,method})).slice(-100):[];}catch{return [];}}
export function saveCorrectionProfile(profiles,{brand,region,rate,checkedOn}){const p={version:1,brand,region,rate:Number(documentNumber(rate)),checkedOn,method:'current-document-hours'};if(!validProfile(p))throw Error('Alege marca, județul/regiunea, data verificării și un tarif pozitiv.');const next=profiles.filter(x=>!(x.brand===brand&&x.region===region));next.push(p);localStorage.setItem(KEY,JSON.stringify(next.slice(-100)));return next;}
export function deleteCorrectionProfiles(){localStorage.removeItem(KEY);}
export function correctionTotal(values,tva){const fields=['ore_tinichigerie','ore_vopsitorie','ora_manopera_acceptata','materiale_vopsitorie_acceptat','piese_acceptat'];if(fields.some(f=>values[f]===''||values[f]===undefined||documentNumber(values[f])===null)||documentNumber(tva)===null||Number(documentNumber(tva))>100)return null;const v=Object.fromEntries(fields.map(f=>[f,Number(documentNumber(values[f]))]));const labor=(v.ore_tinichigerie+v.ore_vopsitorie)*v.ora_manopera_acceptata;const net=labor+v.materiale_vopsitorie_acceptat+v.piese_acceptat;return {labor,net,gross:Math.round(net*(1+Number(documentNumber(tva))/100)*100)/100};}
