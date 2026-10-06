import {documentNumber} from './documentExtract';
export function buildMarkup(report,removed={}){
 if(!report||report.blocked||!report.rows.length||!report.deviz.length)throw Error('Corelarea este incompletă sau blocată. Verifică documentele înainte de export.');
 const marks=new Map();
 for(const row of report.rows)for(const d of row.matches){
  // Paint is expected for a painted replacement/repaired part, but replacing a part
  // when NC only asks for paint is a discrepancy, not a successful operation match.
  const allowed=d.operation===row.nc.operation||(['INL','REP'].includes(row.nc.operation)&&['DR','VOP','RV'].includes(d.operation))||(['VOP','RV'].includes(row.nc.operation)&&['VOP','RV'].includes(d.operation));
  if(!allowed||removed[d.id])continue;
  if(!marks.has(d.id))marks.set(d.id,{...d,kind:'number',numbers:[]});
  const mark=marks.get(d.id);if(!mark.numbers.includes(row.nc.positionNumber))mark.numbers.push(row.nc.positionNumber);
 }
 let deduction=0;const deductions=[];
 for(const d of report.deviz){if(!removed[d.id])continue;const amount=documentNumber(removed[d.id].amount);
  if(amount===null||!String(removed[d.id].amount).trim())throw Error('Completează și verifică valoarea fără TVA pentru fiecare rând tăiat.');
  deduction+=Number(amount);deductions.push({...d,amount:Number(amount)});marks.set(d.id,{...d,kind:'strike',amount:Number(amount)});
 }
 for(const m of marks.values())if(!m.box||!Number.isFinite(m.box.x)||!Number.isFinite(m.box.y)||m.box.w<=0||m.box.h<=0)throw Error('Lipsește poziția exactă pentru un rând. Reimportă PDF-urile; nu voi pune marcaje într-un loc presupus.');
 return {marks:[...marks.values()],deductions,deduction:Math.round(deduction*100)/100};
}
export function revisedTotal(base,vat,deduction){const net=documentNumber(base),v=documentNumber(vat);if(net===null||v===null||Number(v)>100||deduction>Number(net))throw Error('Verifică totalul inițial fără TVA, cota TVA și valoarea scăzută.');const result=Math.round((Number(net)-deduction)*100)/100;return {base:Number(net),vat:Number(v),net:result,gross:Math.round(result*(1+Number(v)/100)*100)/100};}
