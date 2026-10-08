/** @archivo SettlementsPage.tsx @descripcion Bandeja privada de cobros, destino profesional y comision OfiAI. */
import { useState, type FormEvent } from 'react';
import { RefreshCw, Wallet, CheckCircle, Save, ChevronRight, ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import { api } from '../lib/api/client';
import type { SettlementOverview, SettlementRow, SettlementAccount } from '../../../shared/settlements';
import { ContractFeeSettings } from './ContractFeeSettings';
const states = { PENDING:'Pendiente',REVIEW:'Requiere revision',READY:'Elegible para liquidar',MANUALLY_RECORDED:'Transferencia registrada' };
/** Formatea monedas por su precision, sin sumar importes de distintas monedas. */
function money(row:SettlementRow,amount:number|null):string { return amount===null ? 'Sin confirmar' : (amount/10**row.minorDigits).toLocaleString('es-AR',{ style:'currency',currency:row.currency }); }
/** Recurso aislado por usuario y con acceso efectivo validado en Express. */
export function SettlementsPage() {
  const { user }=useAuth(); return <DashboardLayout><SettlementDashboard key={user?.id} /></DashboardLayout>;
}
/** Bandeja operativa: no interpreta marcar un registro como transferencia bancaria. */
function SettlementDashboard() {
  const resource=useApiResource<SettlementOverview>('/settlements');
  const [selected,setSelected]=useState<string|null>(null); const [filter,setFilter]=useState(''); const [query,setQuery]=useState('');
  const row=resource.data?.items.find(item=>item.jobId===selected);
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Cobros y liquidaciones</h1><p className="text-sm text-gray-600">Profesionales, cuentas de destino y comision OfiAI</p></div>
      <button className="ofi-btn-secondary" title="Actualizar cobros" aria-label="Actualizar cobros" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={18}/></button></header>
    <p className="border-l-4 border-emerald-600 bg-emerald-50 p-4 text-emerald-950">La comision de OfiAI se suma al total del contratante. No forma parte del importe a transferir al profesional.</p>
    {resource.loading && <p role="status">Consultando cobros...</p>}
    {resource.error && <p role="alert" className="text-red-700">{resource.error}</p>}
    {row ? <><button className="ofi-btn-secondary" onClick={()=>setSelected(null)}><ArrowLeft size={17}/>Volver a cobros</button>
      <SettlementDetail key={row.jobId+':'+row.account?.version+':'+row.status} row={row} reload={resource.reload}/></> : <>
      <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Buscar<input className="ofi-input" value={query} onChange={event=>setQuery(event.target.value)} /></label>
        <label className="grid gap-1 text-sm">Estado<select className="ofi-input" value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Todos</option>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-sky-50">{['Profesional / trabajo','Cobrado','Para el profesional','Comision OfiAI','Estado',''].map((label,index)=><th key={index} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{resource.data?.items.filter(item=>(!filter||item.status===filter) && (item.professionalName+' '+item.jobId+' '+item.clientName).toLowerCase().includes(query.toLowerCase())).map(item=><tr key={item.jobId} className="border-b">
          <td className="px-3 py-4"><strong>{item.professionalName}</strong><div className="max-w-56 break-words text-xs text-gray-600">{item.jobId}</div></td>
          <td className="px-3 py-4 whitespace-nowrap">{money(item,item.collectedMinor)}</td><td className="px-3 py-4 whitespace-nowrap">{money(item,item.professionalTransferMinor)}</td>
          <td className="px-3 py-4 whitespace-nowrap">{money(item,item.ofiaiFeeMinor)} ({item.commissionBps/100}%)</td><td className="px-3 py-4">{states[item.status]}</td>
          <td><button className="ofi-btn-secondary" title={'Ver liquidacion de '+item.professionalName} aria-label={'Ver liquidacion de '+item.professionalName} onClick={()=>setSelected(item.jobId)}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>
      {resource.data?.items.length===0 && <p>No hay contrataciones con un desglose registrado.</p>}
      {resource.data?.hasMore && <p>Se muestran las 50 contrataciones mas recientes.</p>}
    </>}
    {!resource.loading&&!resource.error&&<details className="border-t py-4"><summary className="cursor-pointer font-semibold">Configuracion de comisiones</summary><ContractFeeSettings/></details>}
  </div>;
}
/** Solo el servidor determina importe, destinatario, permisos y disponibilidad de la liquidacion. */
function SettlementDetail({ row,reload }:{ row:SettlementRow;reload:()=>void }) {
  const [reason,setReason]=useState(''); const [reference,setReference]=useState(''); const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [key]=useState(()=>crypto.randomUUID());
  /** Conserva la clave en los reintentos para evitar registrar dos veces el mismo egreso. */
  async function submit(kind:'verify'|'transfer'):Promise<void> {
    if(busy || !row.account) return; setBusy(true);setMessage('');
    try {
      if(kind==='verify') await api.post('/settlements/accounts/'+encodeURIComponent(row.professionalUserId)+'/verify',{ version:row.account.version,reason });
      else await api.post('/settlements/'+encodeURIComponent(row.jobId)+'/record-transfer',{ idempotencyKey:key,accountVersion:row.account.version,reference,confirmTransferred:confirm });
      setMessage('Registro guardado.');reload();
    } catch(error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  const lines:Array<[string,number|null]>=[['Presupuesto profesional',row.quoteMinor],['Comision OfiAI ('+row.commissionBps/100+'%)',row.ofiaiFeeMinor],
    ['Procesamiento estimado',row.processingEstimatedMinor],['Impuestos y retenciones estimados',row.taxesEstimatedMinor],['Total del contratante',row.clientTotalMinor],
    ['Cobro confirmado',row.collectedMinor],['Costos reales del proveedor',row.providerCostsActualMinor],['Neto acreditado',row.netReceivedMinor],
    ['A transferir al profesional',row.professionalTransferMinor],['Neto estimado de OfiAI',row.ofiaiNetEstimatedMinor],['Neto real de OfiAI antes de liquidar',row.ofiaiNetActualMinor]];
  return <section className="space-y-5"><h2 className="text-xl font-semibold">{row.professionalName}</h2><p>Contratante: {row.clientName}</p>
    <dl className="grid gap-x-8 md:grid-cols-2">{lines.map(([label,amount])=><div key={label} className="flex flex-wrap justify-between gap-2 border-b py-3"><dt>{label}</dt><dd className="font-semibold">{money(row,amount)}</dd></div>)}</dl>
    <p>Estado del cobro: {row.paymentStatus}. ID: {row.paymentId ?? 'Sin cobro registrado'}.</p>
    {row.shortageMinor!==null && row.shortageMinor>0 && <p role="alert" className="bg-red-50 p-4 text-red-800">Diferencia por cubrir: {money(row,row.shortageMinor)}. No se reduce el importe profesional ni la comision de OfiAI.</p>}
    <div className="border-t pt-4"><h3 className="text-lg font-semibold">Cuenta de destino</h3>{row.account ? <dl className="grid gap-2"><div><dt>Titular</dt><dd>{row.account.holder}</dd></div>
      <div><dt>{row.account.kind==='alias'?'Alias':'CBU / CVU'}</dt><dd className="break-all font-mono">{row.account.account}</dd></div><div><dt>Verificacion</dt><dd>{row.account.verified?'Verificada por administracion':'Pendiente'}</dd></div></dl> : <p>El profesional todavia no registro una cuenta de cobro.</p>}</div>
    {row.account && !row.account.verified && <form className="grid gap-3" onSubmit={event=>{event.preventDefault();void submit('verify');}}>
      <label>Constancia de verificacion de titularidad<textarea className="ofi-input mt-1 w-full" value={reason} onChange={event=>setReason(event.target.value)} minLength={10} maxLength={500} required/></label>
      <button className="ofi-btn-secondary w-fit" disabled={busy}><CheckCircle size={17}/>Registrar verificacion</button></form>}
    {row.blockers.length>0 && <ul className="list-disc space-y-1 pl-5 text-sm">{row.blockers.map(text=><li key={text}>{text}</li>)}</ul>}
    {row.readyToTransfer && <form className="grid gap-3 border-t pt-4" onSubmit={event=>{event.preventDefault();void submit('transfer');}}>
      <h3 className="text-lg font-semibold">Registrar transferencia realizada</h3><label>Referencia del comprobante<input className="ofi-input mt-1 w-full" value={reference} onChange={event=>setReference(event.target.value)} minLength={8} maxLength={120} required/></label>
      <label className="flex gap-2"><input type="checkbox" checked={confirm} onChange={event=>setConfirm(event.target.checked)} required/><span>Confirmo que transferi {money(row,row.professionalTransferMinor)} a esta cuenta y conserve {money(row,row.ofiaiFeeMinor)} de comision OfiAI.</span></label>
      <button className="ofi-btn-primary w-fit" disabled={busy||!confirm}><Save size={17}/>Guardar registro manual</button></form>}
    {row.transfer && <p className="bg-emerald-50 p-4">Transferencia registrada manualmente: {row.transfer.reference}. {money(row,row.transfer.amountMinor)}. No es una confirmacion bancaria automatica.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
/** Perfil bancario privado: no aparece en la ficha publica del profesional ni se envia a IA. */
export function SettlementAccountForm() {
  const resource=useApiResource<SettlementAccount|null>('/settlements/account'); const [holder,setHolder]=useState(''); const [account,setAccount]=useState('');
  const [kind,setKind]=useState<'alias'|'cbu_cvu'>('alias'); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  /** Una nueva cuenta siempre vuelve a verificacion. */
  async function save(event:FormEvent):Promise<void> { event.preventDefault();setBusy(true);setMessage('');
    try { await api.put('/settlements/account',{ holder,account,kind,currency:'ARS' });setMessage('Cuenta guardada, pendiente de verificar.');resource.reload(); }
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar.');} finally{setBusy(false);} }
  return <section className="mt-6 border-t py-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Wallet size={20}/>Cuenta para recibir tus pagos</h2>
    {resource.loading&&<p>Cargando...</p>}{resource.error&&<p role="alert">{resource.error}</p>}
    {resource.data&&<p className="my-3">{resource.data.holder} · {resource.data.account} · {resource.data.verified?'Verificada':'Pendiente de verificacion'}</p>}
    <form className="mt-4 grid max-w-xl gap-3" onSubmit={event=>void save(event)}><label>Titular<input className="ofi-input mt-1 w-full" value={holder} onChange={event=>setHolder(event.target.value)} minLength={3} maxLength={150} required/></label>
      <label>Tipo<select className="ofi-input mt-1 w-full" value={kind} onChange={event=>setKind(event.target.value as 'alias'|'cbu_cvu')}><option value="alias">Alias</option><option value="cbu_cvu">CBU / CVU</option></select></label>
      <label>{kind==='alias'?'Alias':'CBU / CVU'}<input className="ofi-input mt-1 w-full" value={account} onChange={event=>setAccount(event.target.value)} minLength={6} maxLength={22} required/></label>
      <button className="ofi-btn-primary w-fit" disabled={busy}><Save size={17}/>Guardar cuenta</button>{message&&<p role="status">{message}</p>}</form>
  </section>;
}
