/** @archivo ContractAgreementPanel.tsx @descripcion Desglose aceptado, cobro normal y expediente del contratante. */
import { useState } from 'react';
import { Check, CreditCard, FileText, Send, RefreshCw, MessageSquareWarning } from 'lucide-react';
import { api } from '../lib/api/client';
import { useApiResource } from '../lib/api/resources';
import { useAuth } from '../context/AuthContext';
import type { ApiResult } from '../../../shared/contracts';
import type { ProtectedContractView, ContractEntry } from '../../../shared/protected-contract';

/** No inicia expedientes, acepta condiciones ni crea pagos durante el montaje. */
export function ContractAgreementPanel({ jobId,canPrepare }:{ jobId:string;canPrepare:boolean }) {
  const path='/jobs/'+encodeURIComponent(jobId)+'/contract'; const { role }=useAuth();
  const resource=useApiResource<ProtectedContractView|null>(path);const c=resource.data;
  const entries=useApiResource<ContractEntry[]>(c?.dispute ? path+'/entries' : null);
  const [consent,setConsent]=useState(false);const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [pending,setPending]=useState<{suffix:string;body:unknown}|null>(null);
  /** Conserva cuerpo y clave del intento hasta confirmacion, incluso despues de un timeout. */
  async function send(suffix:string,body:unknown):Promise<void> {
    if(busy)return;setBusy(true);setMessage('');setPending({suffix,body});
    try {const result=await api.post<ApiResult<{url?:string}>>(suffix.startsWith('/settlements') ? suffix : path+suffix,body);
      if(result.datos?.url)window.location.assign(result.datos.url);setPending(null);setText('');resource.reload();entries.reload();setMessage('Actualizacion registrada.');
    } catch(error){setMessage(error instanceof Error?error.message:'No se pudo confirmar la operacion.');}finally{setBusy(false);}
  }
  /** Comandos semanticamente acotados; importes y destinatarios se resuelven en el backend. */
  function command(action:'accept_terms'|'open_dispute'|'message'):void {
    if(!c)return;void send('/commands',{revision:c.revision,idempotencyKey:crypto.randomUUID(),action,
      ...(action==='accept_terms'?{termsVersion:c.breakdown.termsVersion,acknowledge:true}:action==='open_dispute'?{reason:text}:{text})});
  }
  const b=c?.breakdown;
  /** Solo presentacion, sin recalcular tasas del servidor. */
  function money(n:number):string{return b?(n/10**b.minorDigits).toLocaleString('es-AR',{style:'currency',currency:b.currency}):'';}
  return <section className="coordinator-section space-y-4"><h2>Expediente e importes de la contratacion</h2>
    {resource.loading&&<p role="status">Consultando expediente...</p>}{resource.error&&<p role="alert">{resource.error}</p>}
    {resource.data===null&&<><p>El presupuesto aceptado todavia no tiene un desglose registrado.</p>
      {role==='empresa'&&canPrepare&&<button className="ofi-btn-secondary" disabled={busy||!!pending} onClick={()=>void send('',{})}><FileText size={17}/>Revisar desglose</button>}</>}
    {c&&b&&<><dl className="grid gap-3 sm:grid-cols-2">
      {[['Profesional',b.professionalMinor],['Comision OfiAI ('+b.commissionBps/100+'%)',b.commissionMinor],['Procesamiento estimado',b.processingMinor],['Impuestos y retenciones estimados',b.taxMinor+b.withholdingMinor],['Total del contratante',b.clientTotalMinor]].map(([label,amount])=><div key={String(label)}><dt>{label}</dt><dd className="font-semibold">{money(Number(amount))}</dd></div>)}
    </dl><p className="text-sm">Reglas: {b.policyVersion}. Estado del cobro: {c.financialState==='UNPAID'?'Sin pago registrado':c.financialState}.</p>
      {!b.chargesVerified&&<p className="border-l-4 border-amber-500 bg-amber-50 p-3">Costos del proveedor pendientes de confirmar. El total es estimado y no permite iniciar el cobro.</p>}
      {role==='empresa'&&!c.acceptedAt&&<button className="ofi-btn-secondary" disabled={busy||!!pending} onClick={()=>void send('',{})}><RefreshCw size={17}/>Actualizar desglose no aceptado</button>}
      {role==='empresa'&&!c.acceptedAt&&<><label className="flex gap-2"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>Acepto este desglose y la comision adicional de OfiAI.</span></label>
        <button className="ofi-btn-primary" disabled={busy||!!pending||!consent||!b.chargesVerified} onClick={()=>command('accept_terms')}><Check size={17}/>Confirmar desglose</button></>}
      {c.acceptedAt&&<p>Desglose aceptado: {new Date(c.acceptedAt).toLocaleString('es-AR')}.</p>}
      {role==='empresa'&&c.acceptedAt&&c.financialState==='UNPAID'&&<button className="ofi-btn-primary" disabled={busy||!!pending||!c.collectionEnabled} onClick={()=>void send('/settlements/'+encodeURIComponent(jobId)+'/checkout',{})}><CreditCard size={17}/>Pagar con Mercado Pago</button>}
      <p className="text-sm">Finalizacion profesional: {c.professionalCompletedAt?'Confirmada':'Pendiente'}. Conformidad del contratante: {c.clientApprovedAt?'Confirmada':'Pendiente'}.</p>
      <div className="border-t pt-4"><h3 className="font-semibold">{c.dispute?'Reclamo: '+c.dispute.state:'Reportar un problema'}</h3>{c.dispute&&<p className="break-words">{c.dispute.reason}</p>}
        {entries.data?.map(entry=><p key={entry.id} className="my-3 break-words border-l-2 pl-3"><strong>{entry.actorRole}</strong>: {entry.text}</p>)}
        <label className="mt-3 grid gap-1">{c.dispute?'Mensaje':'Motivo'}<textarea className="ofi-input" rows={3} minLength={10} maxLength={2000} value={text} onChange={event=>setText(event.target.value)}/></label>
        <button className="ofi-btn-secondary mt-3" disabled={busy||!!pending||text.trim().length<10} onClick={()=>command(c.dispute?'message':'open_dispute')}>{c.dispute?<Send size={17}/>:<MessageSquareWarning size={17}/>} {c.dispute?'Enviar mensaje':'Abrir reclamo'}</button>
      </div></>}
    {pending&&<div><p>Solicitud sin confirmar. Consulta el estado o reintenta el mismo envio.</p><button className="ofi-btn-secondary" disabled={busy} onClick={()=>void send(pending.suffix,pending.body)}><RefreshCw size={17}/>Reintentar</button>
      <button className="ofi-btn-secondary ml-2" disabled={busy} onClick={()=>{setPending(null);resource.reload();}}>Consultar estado</button></div>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
