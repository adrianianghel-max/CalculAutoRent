const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const dep='data:text/javascript;base64,'+fs.readFileSync('src/lib/documentExtract.js').toString('base64');const text=fs.readFileSync('src/lib/repairCorrections.js','utf8').replace("'./documentExtract'",JSON.stringify(dep));const m=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const note='manopera tinichigerie cf reparator 2.0 h x 200 lei/h cf manopera de referinta pentru SKODA regiunea CLUJ = 400 lei\nmanopera vopsitorie cf reparator 1.5 h x 200 lei/h cf manopera de referinta pentru SKODA regiunea CLUJ = 300 lei\nmateriale vopsitorie cf reparator 300 lei\npiese + 2 % cf reparator 1000 lei';
const doc={pages:[{page:4,nativeText:note,text:'Incorrect OCR'}]};const got=m.readManualCorrections(doc);assert.equal(got.brand,'SKODA');assert.equal(got.region,'CLUJ');assert.equal(got.values.ora_manopera_acceptata,'200');assert.equal(got.evidence.length,4);assert.equal(m.correctionTotal(got.values,'21').gross,2420);assert.equal(m.correctionTotal({...got.values,piese_acceptat:''},'21'),null);
assert.equal(m.readManualCorrections({pages:[{page:1,text:'0742 1 ARIPA FATA DREAPTA'}]}).evidence.length,0);
const conflict=m.readManualCorrections({pages:[...doc.pages,{page:5,text:note.replaceAll('200','250')}]});assert.ok(conflict.conflicts.includes('ora_manopera_acceptata'));assert.equal(conflict.values.ora_manopera_acceptata,undefined);
let saved='';global.localStorage={getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>saved=''};
const profiles=m.saveCorrectionProfile([],{brand:'SKODA',region:'CLUJ',rate:'200',checkedOn:'2026-10-06'});assert.equal(profiles.length,1);assert.ok(!saved.includes('1000'));assert.ok(!saved.includes('2.0'));assert.equal(m.loadCorrectionProfiles()[0].rate,200);assert.throws(()=>m.saveCorrectionProfile([],{brand:'PERSONAL NAME',region:'CLUJ',rate:'200',checkedOn:'2026-10-06'}));m.deleteCorrectionProfiles();assert.equal(m.loadCorrectionProfiles().length,0);
console.log('OK: explicit correction evidence, calculation, conflicts, context and local profiles without case values.');
})().catch(e=>{console.error(e);process.exit(1)});
