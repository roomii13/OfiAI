/** @archivo ContractFeeSettings.tsx @descripcion Reglas versionadas editables solo por OWNER con MFA reciente. */
import { useState } from 'react';
import { Save,Plus,Trash2 } from 'lucide-react';
import { api } from '../lib/api/client';
import { useApiResource } from '../lib/api/resources';
import type { ContractPolicy } from '../../../shared/protected-contract';
/** La configuracion no modifica silenciosamente presupuestos aceptados. */
export function ContractFeeSettings() {
  const [currency,setCurrency]=useState('ARS');const resource=useApiResource<ContractPolicy>('/resolution/policy/'+currency);
  return <section className="space-y-4 border-t pt-5"><h2 className="text-xl font-semibold">Reglas de comisiones y costos</h2>
    <label className="grid max-w-xs gap-1">Moneda<select className="ofi-input" value={currency} onChange={event=>setCurrency(event.target.value)}>{['ARS','USD','EUR','BRL','CLP','UYU','MXN','PEN','COP'].map(code=><option key={code}>{code}</option>)}</select></label>
    {resource.loading&&<p>Cargando reglas...</p>}{resource.error&&<p role="alert">{resource.error}</p>}
    {resource.data&&<FeeForm key={currency+':'+resource.data.version} policy={resource.data} reload={resource.reload}/>}
  </section>;
}
/** Desglose explicito de bases y tasas, sin tarifas ficticias precargadas del proveedor. */
function FeeForm({policy,reload}:{policy:ContractPolicy;reload:()=>void}) {
  const [draft,setDraft]=useState(policy);const [categories,setCategories]=useState(Object.entries(policy.categoryBps));
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const rates:Array<[keyof Pick<ContractPolicy,'commissionBps'|'processorBps'|'processorTaxBps'|'platformTaxBps'|'withholdingBps'>,string]>=
    [['commissionBps','Comision OfiAI sobre presupuesto (%)'],['processorBps','Procesamiento sobre total cobrado (%)'],['processorTaxBps','Impuesto sobre procesamiento (%)'],['platformTaxBps','Impuesto sobre comision OfiAI (%)'],['withholdingBps','Retenciones sobre total cobrado (%)']];
  /** La nueva version queda en historial; el backend valida permisos y todas las tasas. */
  async function save():Promise<void>{setBusy(true);setMessage('');try{
    await api.put('/resolution/policy',{policy:{...draft,version:crypto.randomUUID(),categoryBps:Object.fromEntries(categories)},reason});setMessage('Nueva version guardada.');reload();
  }catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar.');}finally{setBusy(false);}}
  return <form className="space-y-4" onSubmit={event=>{event.preventDefault();void save();}}><p>Version vigente: {policy.version}</p>
    <div className="grid gap-4 md:grid-cols-2">{rates.map(([key,label])=><label key={key} className="grid gap-1">{label}<input className="ofi-input" type="number" min="0" max="100" step="0.01" required value={draft[key]/100}
      onChange={event=>setDraft({...draft,[key]:Math.round(Number(event.target.value)*100)})}/></label>)}
      <label className="grid gap-1">Costo fijo de procesamiento ({draft.currency})<input className="ofi-input" type="number" min="0" step={1/10**draft.minorDigits} required value={draft.processorFixedMinor/10**draft.minorDigits} onChange={event=>setDraft({...draft,processorFixedMinor:Math.round(Number(event.target.value)*10**draft.minorDigits)})}/></label>
      <label className="grid gap-1">Doble aprobacion de resoluciones desde ({draft.currency})<input className="ofi-input" type="number" min="0" step={1/10**draft.minorDigits} required value={draft.dualApprovalMinor/10**draft.minorDigits} onChange={event=>setDraft({...draft,dualApprovalMinor:Math.round(Number(event.target.value)*10**draft.minorDigits)})}/></label>
      <label className="grid gap-1">Version de condiciones<input className="ofi-input" required maxLength={100} value={draft.termsVersion} onChange={event=>setDraft({...draft,termsVersion:event.target.value})}/></label>
    </div>
    <h3 className="font-semibold">Comisiones por categoria</h3>{categories.map(([name,rate],index)=><div key={index} className="flex flex-wrap gap-2"><input className="ofi-input min-w-0 flex-1" aria-label={'Categoria '+(index+1)} required maxLength={100} value={name} onChange={event=>setCategories(categories.map((entry,i)=>i===index?[event.target.value,entry[1]]:entry))}/>
      <input className="ofi-input w-28" aria-label={'Porcentaje categoria '+(index+1)} type="number" min="0" max="100" step="0.01" required value={Number(rate)/100} onChange={event=>setCategories(categories.map((entry,i)=>i===index?[entry[0],Math.round(Number(event.target.value)*100)]:entry))}/>
      <button type="button" className="ofi-btn-secondary" title="Eliminar regla de categoria" aria-label="Eliminar regla de categoria" onClick={()=>setCategories(categories.filter((_,i)=>i!==index))}><Trash2 size={17}/></button></div>)}
    <button type="button" className="ofi-btn-secondary" onClick={()=>setCategories([...categories,['',draft.commissionBps]])}><Plus size={17}/>Agregar categoria</button>
    <label className="flex gap-2"><input type="checkbox" checked={draft.providerChargesVerified} onChange={event=>setDraft({...draft,providerChargesVerified:event.target.checked})}/><span>Tarifas, bases e impuestos contrastados con el proveedor.</span></label>
    <label className="grid gap-1">Motivo del cambio<textarea className="ofi-input" minLength={10} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} required/></label>
    <button className="ofi-btn-primary" disabled={busy}><Save size={17}/>Guardar nueva version</button>{message&&<p role="status">{message}</p>}
  </form>;
}
