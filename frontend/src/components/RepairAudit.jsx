import {RepairCorrections} from "./RepairCorrections";
import {useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {compareRepair,loadAuditRules,saveAuditRule,clearAuditRules,OPERATIONS} from '@/lib/repairAudit';
import {toast} from 'sonner';

export function RepairAudit({documents,onPickFiles,parsing,form,onApply}){
 const [ncIndex,setNcIndex]=useState(''),[devizIndex,setDevizIndex]=useState(''),[report,setReport]=useState(null),[rules,setRules]=useState(loadAuditRules),[choices,setChoices]=useState({});
 useEffect(()=>{setReport(null);setChoices({});setNcIndex(String(documents.findIndex(d=>/^nc(?:\s*\(\d+\))?\.pdf$/i.test(d.name))));setDevizIndex(String(documents.findIndex(d=>/deviz|calculatie/i.test(d.name))));},[documents]);
 const run=()=>{const n=documents[Number(ncIndex)],d=documents[Number(devizIndex)];if(!n||!d||n===d)return toast.info('Selectează două documente diferite: nota de constatare și devizul.');setReport(compareRepair(n,d,rules));};
 const teach=(nc,item,decision)=>{try{const next=saveAuditRule(rules,nc,item,decision);setRules(next);setReport(compareRepair(documents[Number(ncIndex)],documents[Number(devizIndex)],next));toast.success('Regulă locală salvată. Se păstrează numai codurile de reper și tipul elementului.');}catch(e){toast.info(e.message);}};
 const reset=()=>{try{clearAuditRules();setRules([]);setReport(null);toast.success('Regulile de corelare au fost șterse.');}catch{toast.error('Browserul nu permite ștergerea regulilor.');}};
 return <section className="mb-5 rounded-xl border bg-green-50 p-4 dark:bg-green-950/30" data-testid="repair-audit">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Verificare deviz ↔ Notă de constatare</h2><span className="text-xs text-muted-foreground">{rules.length} reguli locale</span></div>
  <p className="mt-2 text-sm text-muted-foreground">Compară reperele, partea vehiculului și operațiile cerute. Rezultatele sunt indicii pentru verificare, nu aprobări sau respingeri de plată. Lucrările auxiliare pot fi necesare chiar dacă nu apar separat în NC.</p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="min-w-0 flex-1 text-xs">Notă de constatare<select className="mt-1 block w-full rounded border bg-background p-2 text-sm" value={ncIndex} onChange={e=>{setNcIndex(e.target.value);setReport(null);}}><option value="-1">Alege NC</option>{documents.map((d,i)=><option key={i} value={i}>{d.name}</option>)}</select></label>
   <label className="min-w-0 flex-1 text-xs">Deviz reparație<select className="mt-1 block w-full rounded border bg-background p-2 text-sm" value={devizIndex} onChange={e=>{setDevizIndex(e.target.value);setReport(null);}}><option value="-1">Alege devizul</option>{documents.map((d,i)=><option key={i} value={i}>{d.name}</option>)}</select></label>
   <Button variant="outline" onClick={onPickFiles} disabled={parsing}>Selectează PDF-uri</Button><Button onClick={run} disabled={parsing||!documents.length}>Verifică devizul</Button>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">Încarcă NC și devizul împreună. Datele sunt citite local și completează și formularul. Pentru învățare, confirmă o asociere corectă sau alege reperul corect din deviz. Nu se memorează documente, nume, VIN-uri ori sume.</p>
  {rules.length>0&&<Button size="sm" variant="ghost" onClick={reset}>Șterge regulile de corelare</Button>}
  {report&&<div className="mt-4 space-y-3" aria-live="polite">
   {report.warnings.map((w,i)=><p key={i} className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">{w}</p>)}
   <p className="text-sm font-medium">{report.rows.length} repere NC • {report.rows.filter(r=>r.status==='found').length} cu operația regăsită • {report.rows.filter(r=>['missing','operation'].includes(r.status)).length} de verificat</p>
   {report.rows.map(r=><article key={r.nc.id} className="rounded-lg border bg-background p-3">
    <h3 className="font-semibold">{r.nc.code} — {r.nc.text} · {OPERATIONS[r.nc.operation]}</h3>
    <p className="text-xs text-muted-foreground">NC: {r.nc.source}, pagina {r.nc.page}{r.nc.ocr?' · OCR':''}</p>
    <p className={`my-2 text-sm font-medium ${r.status==='found'?'text-green-700':'text-amber-700'}`}>{r.message}</p>
    {r.matches.map(d=><div key={d.id} className="my-2 rounded border p-2 text-sm"><p>{d.text}</p><p className="text-xs text-muted-foreground">{d.source}, pagina {d.page} · {OPERATIONS[d.operation]} · {d.reason}{d.ocr?' · OCR':''}</p><div className="mt-1 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>teach(r.nc,d,'match')}>Confirmă asocierea și învață</Button><Button size="sm" variant="ghost" onClick={()=>teach(r.nc,d,'reject')}>Asociere greșită</Button></div></div>)}
    {r.conflicts.length>0&&<details className="text-sm text-amber-700"><summary>Posibile contradicții de reper sau stânga/dreapta/față/spate ({r.conflicts.length})</summary>{r.conflicts.map(d=><p key={d.id}>{d.text} — pagina {d.page}</p>)}</details>}
    {!report.blocked&&<div className="mt-2 flex flex-wrap gap-2"><select aria-label={`Corectează asocierea pentru ${r.nc.code}`} className="min-w-0 max-w-full flex-1 rounded border bg-background p-2 text-xs" value={choices[r.nc.id]||''} onChange={e=>setChoices({...choices,[r.nc.id]:e.target.value})}><option value="">Alege manual reperul corect din deviz…</option>{report.deviz.map(d=><option key={d.id} value={d.id}>p. {d.page} · {d.text}</option>)}</select><Button variant="outline" size="sm" disabled={!choices[r.nc.id]} onClick={()=>{const d=report.deviz.find(item=>item.id===choices[r.nc.id]);if(d)teach(r.nc,d,'match');}}>Învață corecția</Button></div>}
   </article>)}
   {!report.blocked&&<details className="rounded border bg-background p-3"><summary className="cursor-pointer font-medium">Poziții suplimentare / auxiliare fără asociere directă ({report.extras.length})</summary><p className="my-2 text-xs text-muted-foreground">Verifică necesitatea tehnică și eventualele reconstatări. Absența din NC nu înseamnă automat cost nejustificat. Lista poate fi incompletă dacă OCR-ul nu a citit toate rândurile.</p>{report.extras.map(d=><p key={d.id} className="border-t py-2 text-sm">{d.text}<span className="block text-xs text-muted-foreground">Pagina {d.page} · {OPERATIONS[d.operation]}{d.ocr?' · OCR':''}</span></p>)}</details>}
  </div>}
 <RepairCorrections document={documents[Number(devizIndex)]} form={form} onApply={onApply}/>
 </section>;
}
