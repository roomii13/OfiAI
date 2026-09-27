/** @archivo OperationsPanels.tsx @descripcion Revision operativa y Command Center sin acciones financieras implicitas. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource,metricLabel } from '../lib/api/resources';
import { AgentState,AgentRefresh,useAgentAction } from './AgentWorkspace';
import { FactGrid } from './IntelligencePanels';
import type { OperationsList,OperationsResource,OperationsRow,CommandCenter } from '../../../shared/operations';
const resourceLabels:Record<OperationsResource,string>={users:'Usuarios',companies:'Empresas',professionals:'Profesionales',jobs:'Trabajos',subscriptions:'Suscripciones',transactions:'Transacciones',matches:'Matches'};
/** Consulta paginada y moderacion con motivo obligatorio. */
export function OperationsPanel() {
  const [resource,setResource]=useState<OperationsResource>('users');const [cursor,setCursor]=useState('');const [jobId,setJobId]=useState('');
  const data=useApiResource<OperationsList>(resource==='matches'&&!jobId?null:'/admin/operations?resource='+resource+(cursor?'&cursor='+cursor:'')+(jobId?'&jobId='+encodeURIComponent(jobId):''));
  const action=useAgentAction(data.reload);const [reason,setReason]=useState('');
  /** No ofrece reembolsos, cobros ni contratacion desde moderacion. */
  function moderate(row:OperationsRow,command:string) {
    if(!window.confirm('Confirmar '+command+' para este registro?'))return;
    void action.run('/admin/operations/commands',{targetId:row.id,action:command,reason});
  }
  return <><div className="agent-row"><h2>Administracion operativa</h2><AgentRefresh onClick={data.reload}/></div>
    <div className="agent-form"><label>Registros<select value={resource} onChange={e=>{setResource(e.target.value as OperationsResource);setCursor('');}}>
      {Object.entries(resourceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {resource==='matches'&&<label>Trabajo ID<input value={jobId} maxLength={128} onChange={e=>setJobId(e.target.value)}/></label>}
      <label>Motivo de moderacion<textarea value={reason} minLength={5} maxLength={500} onChange={e=>setReason(e.target.value)}/></label></div>
    <AgentState loading={data.loading} error={data.error||action.notice}/>
    <div className="agent-list">{data.data?.rows.map(row=><article className="agent-item" key={row.id}>
      <h3>{String(row.fields.nombre??row.fields.nombreEmpresa??row.fields.titulo??row.fields.plan??row.id)}</h3>
      <dl>{Object.entries(row.fields).map(([key,value])=><div className="agent-row" key={key}><dt>{metricLabel(key)}:</dt><dd>{value===null?'No informado':typeof value==='boolean'?value?'Si':'No':String(value)}</dd></div>)}</dl>
      <small>ID: {row.id}</small><div className="agent-row">
        {resource==='users'&&<button disabled={action.busy||reason.trim().length<5} className="ofi-btn-secondary" onClick={()=>moderate(row,row.fields.activo?'suspend_user':'restore_user')}>{row.fields.activo?'Suspender':'Restaurar'}</button>}
        {resource==='professionals'&&<button disabled={action.busy||reason.trim().length<5} className="ofi-btn-secondary" onClick={()=>moderate(row,row.fields.verificado?'unverify_professional':'verify_professional')}>{row.fields.verificado?'Retirar verificacion':'Verificar profesional'}</button>}
        {resource==='jobs'&&<button disabled={action.busy||reason.trim().length<5} className="ofi-btn-secondary" onClick={()=>moderate(row,row.fields.moderationStatus==='flagged'?'clear_job':'flag_job')}>{row.fields.moderationStatus==='flagged'?'Cerrar revision':'Marcar para revision'}</button>}
      </div></article>)}</div>
    {data.data?.rows.length===0&&<p>No hay registros.</p>}
    <div className="agent-row">{cursor&&<button className="ofi-btn-secondary" onClick={()=>setCursor('')}>Primera pagina</button>}{data.data?.nextCursor&&<button className="ofi-btn-secondary" onClick={()=>setCursor(data.data!.nextCursor!)}>Siguiente pagina</button>}</div>
    <div className="agent-row"><Link to="/operations/support">Soporte y reclamos</Link><Link to="/operations/governance">Agentes y errores</Link><Link to="/subscriptions">Ingresos y pagos</Link></div>
  </>;
}
/** Mercado, producto, economia y agentes con limites visibles. */
export function CommandCenterPanel() {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));const data=useApiResource<CommandCenter>('/admin/command-center?month='+month);
  return <><div className="agent-row"><h2>OFIAI COMMAND CENTER</h2><AgentRefresh onClick={data.reload}/></div>
    <label className="agent-form">Periodo financiero<input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>
    <AgentState loading={data.loading} error={data.error}/>
    {data.data&&<><h3>Producto y ventas</h3><div className="agent-metrics">
      <div className="agent-metric">Leads<strong>{data.data.funnel.leads}</strong></div><div className="agent-metric">Clientes CRM<strong>{data.data.funnel.customers}</strong></div>
      <div className="agent-metric">Conversion CRM<strong>{data.data.funnel.conversion===null?'Sin datos':(data.data.funnel.conversion*100).toFixed(1)+'%'}</strong></div>
      <div className="agent-metric">Tickets abiertos<strong>{data.data.operations.openTickets}</strong></div><div className="agent-metric">Trabajos en revision<strong>{data.data.operations.flaggedJobs}</strong></div>
    </div><p className="agent-muted">{data.data.funnel.definition}</p>
    <h3>Mercado</h3><div className="agent-grid"><section>{data.data.snapshot.categories.map(row=><p key={row.name}>{row.name}: {row.jobs} solicitudes</p>)}</section>
      <section>{data.data.snapshot.cities.map(row=><p key={row.name}>{row.name}: {row.demand} solicitudes / {row.supply??'sin datos'} perfiles disponibles</p>)}</section></div>
    <h3>Economia y actividad</h3><FactGrid facts={data.data.snapshot.facts}/>
    <h3>IA</h3><div className="agent-metrics">{Object.entries(data.data.ai).map(([label,value])=><div className="agent-metric" key={label}>{metricLabel(label)}<strong>{value===null?'No medido':value.toLocaleString()}</strong></div>)}</div>
    {data.data.limitations.map(note=><p className="agent-muted" key={note}>{note}</p>)}</>}
  </>;
}
