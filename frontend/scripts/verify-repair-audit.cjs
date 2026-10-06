const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const m=await import('data:text/javascript;base64,'+fs.readFileSync('src/lib/repairAudit.js').toString('base64'));
const doc=(name,text)=>({name,pages:[{page:1,text,method:'Text PDF'}]});
const nc=doc('nc.pdf','Dosar daune: TEST12345678\nSOLUTII TEHNICE\n1 0742 ARIPA FATA DREAPTA INL\n2 7202 JANTA FATA DREAPTA INL\nINL - INLOCUIRE');
const dev=doc('deviz.pdf','NUMAR DOSAR: TEST12345678\nVARIANTE ECHIPARE\nJANTA FATA DREAPTA\nBAZA MANOPERA 100 UT=1 ORA\nD/R ARIPA FATA DREAPTA 2 30 120.00\nV O P S I T O R I E (SISTEM AZT)\n0742 ARIPA FATA DREAPTA VOPSIRE PIESE NOI 9\nP I E S E\nNR.GHID BUC. DESCRIERE COD PIESA PRET\n0742 1 ARIPA FATA DREAPTA CODTEST 1000.00\n7202 1 JANTA FATA DREAPTA CODTEST 500.00');
let report=m.compareRepair(nc,dev);assert.equal(report.rows.length,2);assert.ok(report.rows.every(r=>r.status==='found'));assert.equal(report.deviz.length,4);
const wrong=doc('deviz.pdf',dev.pages[0].text.replaceAll('DREAPTA','STANGA'));report=m.compareRepair(nc,wrong);assert.ok(report.rows.every(r=>r.status==='missing'));assert.ok(report.rows.every(r=>r.conflicts.length));
const other=doc('deviz.pdf',dev.pages[0].text.replace('TEST12345678','TEST87654321'));assert.equal(m.compareRepair(nc,other).blocked,true);
const missing=doc('deviz.pdf','NUMAR DOSAR: TEST12345678\nBAZA MANOPERA\nD/R ARIPA FATA DREAPTA 30 120.00');assert.equal(m.compareRepair(nc,missing).rows[0].status,'operation');assert.equal(m.compareRepair(nc,missing).rows[1].status,'missing');
const empty=doc('empty.pdf','');assert.ok(m.compareRepair(empty,empty).warnings.length>=3);
let stored='';global.localStorage={getItem:()=>stored,setItem:(k,v)=>stored=v,removeItem:()=>stored=''};
report=m.compareRepair(nc,dev);const item=report.rows[0].matches.find(d=>d.category==='parts');const rules=m.saveAuditRule([],report.rows[0].nc,item,'match');assert.equal(rules.length,1);for(const pii of ['TEST12345678','nc.pdf','deviz.pdf','1000.00'])assert.ok(!stored.includes(pii));assert.equal(m.loadAuditRules().length,1);
assert.throws(()=>m.saveAuditRule(rules,report.rows[0].nc,{...item,side:'ST'},'match'));
assert.equal(m.compareRepair(nc,wrong,rules).rows[0].status,'missing');
m.clearAuditRules();assert.deepEqual(m.loadAuditRules(),[]);
console.log('OK: repair comparison, table boundaries, sides, operations, case mismatch and private learning.');
})().catch(e=>{console.error(e);process.exit(1)});
