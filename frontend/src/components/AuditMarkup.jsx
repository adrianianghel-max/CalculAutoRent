import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {buildMarkup,revisedTotal} from '@/lib/auditMarkup';
import {exportMarkedDeviz} from '@/lib/pdfExtract';
export function AuditMarkup({report,document,vat}){
 const [removed,setRemoved]=useState({}),[base,setBase]=useState(''),[tax,setTax]=useState(vat||''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 useEffect(()=>{setRemoved({});setBase('');setTax(vat||'');setConfirmed(false);},[report,document,vat]);
 if(!report||report.blocked)return null;
 const extras=new Set(report.extras.map(d=>d.id));
 const change=(id,amount)=>{setRemoved(r=>({...r,[id]:{amount}}));setConfirmed(false);};
 let deduction=null;try{deduction=buildMarkup(report,removed).deduction;}catch{ /* export reports the precise validation error */ }
 const download=async()=>{if(!document?.file)return toast.info('Reimportă PDF-urile pentru a putea exporta copia adnotată.');setBusy(true);try{const markup=buildMarkup(report,removed);const totals=markup.deductions.length?revisedTotal(base,tax,markup.deduction):null;await exportMarkedDeviz(document.file,markup,totals,setProgress);toast.success('Copia devizului adnotat a fost descărcată.');}catch(e){toast.error(e.message||'Nu am putut exporta devizul.');}finally{setBusy(false);setProgress('');}};
 return <div className="mt-4 rounded-lg border border-red-200 bg-background p-3">
 <h3 className="font-semibold">Numerotare roșie, tăieri și deviz revizuit</h3>
 <p className="my-2 text-sm text-muted-foreground">Numărul poziției NC se pune în roșu lângă rândurile concordante de manoperă, vopsitorie și piese. O înlocuire în deviz nu este marcată ca fiind conformă dacă NC cere doar vopsire. Operațiile auxiliare rămân de verificat.</p>
 <details><summary className="cursor-pointer text-sm font-medium">Selectează rândurile de tăiat și confirmă suma de scăzut</summary><p className="my-2 text-xs text-muted-foreground">Completează valoarea totală a fiecărui rând fără TVA, nu prețul unitar. Nu scădea de două ori operații incluse în alte poziții. Pentru vopsitorie în UL/UT, convertește unitățile la tariful corect. Verifică separat efectul asupra adaosurilor și materialelor.</p>
 {report.deviz.map(d=><div key={d.id} className="grid gap-2 border-t py-2 sm:grid-cols-[1fr_160px]"><label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={Boolean(removed[d.id])} onChange={e=>{if(e.target.checked)change(d.id,'');else{setRemoved(r=>{const next={...r};delete next[d.id];return next;});setConfirmed(false);}}}/><span>{d.text}<span className="block text-xs text-muted-foreground">Pagina {d.page} · {extras.has(d.id)?'Fără asociere directă / auxiliar — verifică justificarea':'Element asociat cu NC — verifică operația înainte de excludere'}{d.ocr?' · OCR':''}</span></span></label>{removed[d.id]&&<Input aria-label={`Valoare de scăzut pentru ${d.text}`} placeholder="Total rând fără TVA" inputMode="decimal" value={removed[d.id].amount} onChange={e=>change(d.id,e.target.value)} disabled={busy}/>}</div>)}
 </details>
 {Object.keys(removed).length>0&&<div className="my-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">Total inițial deviz fără TVA (verificat)<Input value={base} inputMode="decimal" onChange={e=>{setBase(e.target.value);setConfirmed(false);}}/></label><label className="text-xs">TVA (%)<Input value={tax} inputMode="decimal" onChange={e=>{setTax(e.target.value);setConfirmed(false);}}/></label><p className="text-sm">{deduction!==null?`De scăzut fără TVA: ${deduction.toFixed(2)} lei`:'Completează valorile și verifică pozițiile rândurilor.'}</p></div>}
 <label className="my-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Am verificat asocierile și eventualele excluderi; confirm exportul copiei adnotate.</label>
 <Button onClick={download} disabled={!confirmed||busy||!report.rows.length||!report.deviz.length}>{busy?progress||'Pregătesc PDF…':'Descarcă devizul cu numere roșii și tăieri'}</Button>
 <p className="mt-2 text-xs text-muted-foreground">Export local: paginile sunt păstrate vizual într-o copie PDF, cu marcaje și o sinteză a scăderilor. Originalul și formularul nu sunt modificate. Verifică poziția marcajelor pe copia descărcată.</p>
 </div>;
}
