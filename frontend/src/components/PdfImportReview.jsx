import { useState, useMemo } from 'react';
import { PDF_FIELDS, DOCUMENT_TYPES, extractDocument, candidateConflict, selectedChanges } from '@/lib/documentExtract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function DocumentReview({ doc, form, onApply }) {
  const [type, setType] = useState('auto');
  const extracted = useMemo(() => extractDocument(doc.pages, doc.name, type), [doc, type]);
  const [edits, setEdits] = useState({});
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [done, setDone] = useState('');
  const rows = extracted.candidates.map((c,i) => ({...c, selected: false, ...edits[i]}));
  const change = (i, patch) => { setEdits(prev=>({...prev,[i]:{...prev[i],...patch}})); setDone(''); };
  const apply = () => {
    try {
      const changes = selectedChanges(rows);
      if (!Object.keys(changes).length) throw new Error('Bifează cel puțin o valoare.');
      if (!replace && Object.keys(changes).some(k => String(form[k] ?? '').trim() && String(form[k]) !== changes[k])) throw new Error('Există câmpuri deja completate. Debifează-le sau permite explicit înlocuirea.');
      onApply(changes); setError(''); setDone(`${Object.keys(changes).length} câmpuri completate.`);
    } catch (e) { setError(e.message); }
  };
  return <div className="rounded-lg border p-3 space-y-3">
    <div className="flex flex-wrap items-center gap-3"><strong className="break-all">{doc.name}</strong><label>Tip document <select aria-label={`Tip document ${doc.name}`} className="ml-2 rounded border bg-background p-2" value={type} onChange={e=>{setType(e.target.value);setEdits({});setDone('');setError('');}}>{Object.entries(DOCUMENT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
    <p className="text-xs text-muted-foreground">Recunoscut: {[...new Set(extracted.pageTypes)].map(t=>DOCUMENT_TYPES[t]).join(', ')}. Dacă tipul este greșit, alege-l din listă. Pentru un PDF mixt, păstrează recunoașterea automată.</p>
    {doc.pages.map(p=>p.warning && <p key={p.page} className="text-sm text-amber-700">Pagina {p.page}: {p.warning}</p>)}
    {!rows.length && <p className="text-sm">Nu am recunoscut valori. Alege tipul documentului sau verifică textul paginilor de mai jos.</p>}
    {!!rows.length && <><Button variant="outline" size="sm" onClick={()=>setEdits(Object.fromEntries(rows.map((r,i)=>[i,{...edits[i],selected: Boolean(r.field && !String(form[r.field] ?? '').trim() && !r.note && !candidateConflict(r,rows))}])))}>Selectează câmpurile goale fără conflict</Button>
    <div className="overflow-x-auto max-h-[480px] overflow-y-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="text-left"><th>Aplică</th><th>Câmp</th><th>Valoare propusă</th><th>Valoare actuală / sursă</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${type}-${i}`} className="border-t align-top"><td className="p-2"><input type="checkbox" aria-label={`Aplică valoarea ${i+1}`} checked={r.selected} onChange={e=>change(i,{selected:e.target.checked})}/></td><td className="p-2"><select className="max-w-64 rounded border bg-background p-2" aria-label={`Câmp destinație ${i+1}`} value={r.field} onChange={e=>change(i,{field:e.target.value})}><option value="">Alege câmpul…</option>{Object.entries(PDF_FIELDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td><td className="p-2"><Input aria-label={`Valoare propusă ${i+1}`} value={r.value} onChange={e=>change(i,{value:e.target.value})}/>{candidateConflict(r,rows) && <p className="text-amber-700">Valori diferite pentru același câmp.</p>}{r.note && <p className="text-xs text-amber-700">{r.note}</p>}</td><td className="p-2 max-w-sm"><p>Actual: {String(form[r.field] || '—')}</p><p className="text-xs text-muted-foreground">Pagina {r.page} • {doc.pages.find(p=>p.page===r.page)?.method}</p><details><summary className="cursor-pointer text-primary">Fragment sursă</summary><p className="whitespace-pre-wrap break-words text-xs">{r.evidence}</p></details></td></tr>)}</tbody></table></div>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/> Permit înlocuirea câmpurilor deja completate, numai pentru rândurile bifate.</label>
    <Button onClick={apply}>Completează valorile bifate</Button></>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}{done && <p role="status" className="text-green-700">{done}</p>}
    <details><summary className="cursor-pointer text-sm">Text extras pe pagini (doar în această sesiune)</summary>{doc.pages.map(p=><details key={p.page} className="p-2"><summary>Pagina {p.page} • {p.method}</summary><pre className="text-xs whitespace-pre-wrap max-h-64 overflow-auto">{p.text || 'Fără text recunoscut.'}</pre></details>)}</details>
  </div>;
}
export function PdfImportReview({ documents, form, onApply, onClose }) {
  return <section aria-label="Verificare date PDF" className="mb-6 rounded-xl border border-green-300 bg-green-50 p-4 space-y-4 dark:bg-green-950/30">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">Verifică datele extrase din PDF</h2><Button variant="outline" onClick={onClose}>Închide și elimină textele extrase</Button></div>
    <p className="text-sm">Citire și OCR locale în browser. Documentele și textele extrase nu sunt trimise unui serviciu AI și nu sunt salvate de importator. Verifică sursa și bifează valorile dorite. Orele și sumele în lei sunt câmpuri separate; valorile acceptate rămân la decizia ta.</p>
    {documents.map((doc,i)=><DocumentReview key={i} doc={doc} form={form} onApply={onApply}/>)}
  </section>;
}
