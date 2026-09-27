/** @archivo MobileOperationsPanels.tsx @descripcion Administracion interna y BI con permisos equivalentes a web. */
import { useState } from 'react';
import { useMobileResource,metricLabel } from '../lib/resources';
import { OText,OInput,OSelect,OButton,OItem,OState,confirmOperation,useOperationsAction } from './AgentOperationsUi';
import type { OperationsList,OperationsResource,CommandCenter } from '../../../shared/operations';
/** Revisiones administrativas explicitas, con motivo y confirmacion nativa. */
export function MobileOperationsPanel() {
  const [resource,setResource]=useState<OperationsResource>('users');const [cursor,setCursor]=useState('');const [jobId,setJobId]=useState('');const [reason,setReason]=useState('');
  const data=useMobileResource<OperationsList>(resource==='matches'&&!jobId?null:'/admin/operations?resource='+resource+(cursor?'&cursor='+cursor:'')+(jobId?'&jobId='+encodeURIComponent(jobId):''));
  const action=useOperationsAction(data.reload);
  return <><OText title>Administracion operativa</OText><OButton label="Actualizar" icon="refresh-outline" onPress={data.reload}/>
    <OSelect label="Registros" value={resource} onChange={value=>{setResource(value as OperationsResource);setCursor('');}}
      options={['users','companies','professionals','jobs','subscriptions','transactions','matches'].map(value=>({value,label:value}))}/>
    {resource==='matches'&&<OInput label="Trabajo ID" value={jobId} onChange={setJobId} max={128}/>}
    <OInput label="Motivo de moderacion" value={reason} onChange={setReason} multiline max={500}/>
    <OState loading={data.loading} error={data.error||action.error}/>
    {data.data?.rows.map(row=>{
      const command=resource==='users'?(row.fields.activo?'suspend_user':'restore_user'):resource==='professionals'?(row.fields.verificado?'unverify_professional':'verify_professional'):
        resource==='jobs'?(row.fields.moderationStatus==='flagged'?'clear_job':'flag_job'):null;
      const label=command?{suspend_user:'Suspender usuario',restore_user:'Restaurar usuario',verify_professional:'Verificar profesional',unverify_professional:'Retirar verificacion',
        flag_job:'Marcar para revision',clear_job:'Cerrar revision'}[command]:'';
      return <OItem key={row.id}><OText title>{String(row.fields.nombre??row.fields.nombreEmpresa??row.fields.titulo??row.fields.plan??row.id)}</OText>
        {Object.entries(row.fields).map(([key,value])=><OText key={key}>{metricLabel(key)}: {value===null?'No informado':typeof value==='boolean'?value?'Si':'No':String(value)}</OText>)}
        <OText>ID: {row.id}</OText>{command&&<OButton label={label} disabled={action.busy||reason.trim().length<5} onPress={()=>confirmOperation(label+'?',
          ()=>{void action.run('/admin/operations/commands',{targetId:row.id,action:command,reason});})}/>}</OItem>;
    })}
    {cursor&&<OButton label="Primera pagina" onPress={()=>setCursor('')}/>}
    {data.data?.nextCursor&&<OButton label="Siguiente pagina" icon="arrow-forward-outline" onPress={()=>setCursor(data.data!.nextCursor!)}/>}
  </>;
}
/** No transforma la falta de medicion de cohortes en porcentajes ficticios. */
export function MobileCommandCenterPanel() {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const data=useMobileResource<CommandCenter>(/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?'/admin/command-center?month='+month:null);
  return <><OText title>OFIAI COMMAND CENTER</OText><OButton label="Actualizar" icon="refresh-outline" onPress={data.reload}/>
    <OInput label="Periodo financiero AAAA-MM" value={month} onChange={setMonth} max={7}/>
    <OState loading={data.loading} error={data.error}/>
    {data.data&&<>
      <OText title>Producto y ventas</OText><OText>Leads: {data.data.funnel.leads} · Clientes CRM: {data.data.funnel.customers}</OText>
      <OText>Conversion CRM: {data.data.funnel.conversion===null?'Sin datos':(data.data.funnel.conversion*100).toFixed(1)+'%'}</OText><OText>{data.data.funnel.definition}</OText>
      <OText>Tickets abiertos: {data.data.operations.openTickets} · Trabajos en revision: {data.data.operations.flaggedJobs}</OText>
      <OText title>Mercado</OText>{data.data.snapshot.categories.map(row=><OText key={row.name}>{row.name}: {row.jobs} solicitudes</OText>)}
      {data.data.snapshot.cities.map(row=><OText key={row.name}>{row.name}: {row.demand} solicitudes / {row.supply??'Sin datos'} perfiles disponibles</OText>)}
      <OText title>Economia y actividad</OText>{data.data.snapshot.facts.map(fact=><OItem key={fact.id}><OText>{fact.label}</OText><OText title>{fact.value??'Sin datos'} {fact.currency??''}</OText>
        {fact.note&&<OText>{fact.note}</OText>}<OText>Fuente: {fact.source}</OText></OItem>)}
      <OText title>IA</OText>{Object.entries(data.data.ai).map(([key,value])=><OText key={key}>{metricLabel(key)}: {value===null?'No medido':value.toLocaleString()}</OText>)}
      {data.data.limitations.map(note=><OText key={note}>{note}</OText>)}
    </>}
  </>;
}
