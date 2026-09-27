/** @archivo IntelligencePanels.tsx @descripcion Evidencia de negocio, ejecuciones y gobierno IA. */
import { useState } from 'react';
import { Send,Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import { AgentState,AgentRefresh,useAgentAction } from './AgentWorkspace';
import type { IntelligenceSnapshot,IntelligenceAnswer,IntelligenceFact } from '../../../shared/intelligence';
import type { AgentRun } from '../../../shared/orchestrator';
/** Distingue moneda, tasas y ausencia de evidencia. */
export function FactGrid({facts}: {facts:IntelligenceFact[]}) {
  return <div className="agent-metrics">{facts.map(fact=><div className="agent-metric" key={fact.id}><span>{fact.label}</span>
    <strong>{fact.value===null?'Sin datos':typeof fact.value==='number'?fact.value.toLocaleString(undefined,{maximumFractionDigits:2}):fact.value} {fact.currency??''}</strong>
    {fact.note&&<p className="agent-muted">{fact.note}</p>}<small>Fuente: {fact.source}</small></div>)}</div>;
}
/** Preguntas operativas con evidencia del tenant y sin predicciones inventadas. */
export function IntelligencePanel() {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));const snapshot=useApiResource<IntelligenceSnapshot>('/intelligence?month='+month);
  const [question,setQuestion]=useState('');const [answer,setAnswer]=useState<IntelligenceAnswer|null>(null);const action=useAgentAction();
  return <><div className="agent-row"><h2>Inteligencia de negocio</h2><AgentRefresh onClick={snapshot.reload}/></div>
    <label className="agent-form">Mes de facturacion<input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>
    <form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run<IntelligenceAnswer>('/intelligence/questions',{question,month}).then(value=>{if(value)setAnswer(value);});}}>
      <label>Tu pregunta<input required minLength={3} maxLength={1000} value={question} onChange={e=>setQuestion(e.target.value)}/></label>
      <button className="ofi-btn-primary" disabled={action.busy}><Send size={17}/>Consultar</button></form>
    <AgentState loading={snapshot.loading} error={snapshot.error||action.notice}/>
    {answer&&<section className="agent-section"><h3>{answer.question}</h3><p>{answer.answer}</p><FactGrid facts={answer.facts}/>
      <p className="agent-muted">{answer.limitations.join(' ')} · {answer.method==='structured_ai'?'Seleccion de evidencia con IA':'Analisis por reglas'}</p></section>}
    {snapshot.data&&<><FactGrid facts={snapshot.data.facts}/>
      {snapshot.data.partial&&<p className="agent-error">La muestra esta limitada; no representa el total de la plataforma.</p>}
      <div className="agent-grid"><section><h3>Categorias</h3>{snapshot.data.categories.map(item=><p key={item.name}>{item.name}: {item.jobs} solicitudes · {item.completed} completadas</p>)}</section>
        <section><h3>Ciudades</h3>{snapshot.data.cities.map(item=><p key={item.name}>{item.name}: {item.demand} solicitudes · {item.supply===null?'Oferta no disponible':item.supply+' perfiles disponibles'}</p>)}</section></div>
      <section className="agent-section"><h3>Fechas a revisar</h3>{snapshot.data.delayed.length===0&&<p>No hay alertas por fechas registradas.</p>}
        {snapshot.data.delayed.map(job=><p key={job.jobId}><a href="/jobs">{job.title}</a>: {job.reason}</p>)}</section>
    </>}
  </>;
}
/** Los efectos comerciales siguen requiriendo confirmacion en sus pantallas propias. */
export function AgentRunsPanel() {
  const {role}=useAuth();const runs=useApiResource<AgentRun[]>('/agents/runs');
  const [event,setEvent]=useState('business.review');const [resourceId,setResourceId]=useState('');
  const action=useAgentAction(runs.reload);
  return <><div className="agent-row"><h2>Ejecuciones de agentes</h2><AgentRefresh onClick={runs.reload}/></div>
    <form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run('/agents/runs',{event,requestId:crypto.randomUUID(),...(resourceId?{resourceId}:{})});}}>
      <label>Recorrido<select value={event} onChange={e=>setEvent(e.target.value)}><option value="business.review">Analisis de negocio</option>
        {role==='empresa'&&<option value="job.review">Revisar trabajo</option>}{role==='admin'&&<option value="sales.review">Calificar lead</option>}</select></label>
      {event!=='business.review'&&<label>Identificador<input required maxLength={128} value={resourceId} onChange={e=>setResourceId(e.target.value)}/></label>}
      <button disabled={action.busy} className="ofi-btn-primary"><Play size={17}/>{action.busy?'Ejecutando...':'Ejecutar'}</button>
    </form><AgentState loading={runs.loading} error={runs.error||action.notice}/>
    <div className="agent-list">{runs.data?.map(run=><article className="agent-item" key={run.id}><h3>{run.event} · {run.status}</h3><p>{run.message}</p>
      <small>{new Date(run.createdAt).toLocaleString()} · {(run.durationMs/1000).toFixed(1)} s</small>
      {run.steps.map((step,index)=><p key={index}>{step.agent} / {step.tool}: {step.status} · {step.attempts} intento(s)</p>)}</article>)}</div>
    {runs.data?.length===0&&<p>No hay ejecuciones registradas.</p>}
  </>;
}
interface GovernanceData {scope:string;metrics:Record<string,number|null>;observations:Array<{id:string;agent:string;status:string;durationMs:number;estimatedCostUsd:number|null;fallbackReason:string|null;startedAt:string}>;}
/** Nunca etiqueta como costo cero una medicion que no esta disponible. */
export function GovernancePanel() {
  const resource=useApiResource<GovernanceData>('/governance');const action=useAgentAction(resource.reload);
  return <><div className="agent-row"><h2>Gobierno y observabilidad IA</h2><AgentRefresh onClick={resource.reload}/></div>
    <AgentState loading={resource.loading} error={resource.error||action.notice}/>
    <p className="agent-muted">{resource.data?.scope}</p>
    <div className="agent-metrics">{Object.entries(resource.data?.metrics??{}).map(([label,value])=><div className="agent-metric" key={label}>{label}<strong>{value===null?'No medido':value.toLocaleString()}</strong></div>)}</div>
    <div className="agent-list">{resource.data?.observations.map(row=><article className="agent-item" key={row.id}><h3>{row.agent} · {row.status}</h3>
      <p>{row.durationMs} ms · Costo estimado USD: {row.estimatedCostUsd===null?'no disponible':row.estimatedCostUsd.toFixed(6)}</p>
      {row.fallbackReason&&<p>Fallback: {row.fallbackReason}</p>}
      <label>Revision humana<select value="" disabled={action.busy} onChange={e=>void action.run('/governance/'+row.id+'/reviews',{verdict:e.target.value})}>
        <option value="">Registrar evaluacion</option><option value="acceptable">Aceptable</option><option value="suspected_hallucination">Posible alucinacion</option><option value="confirmed_issue">Problema confirmado</option></select></label>
    </article>)}</div>
  </>;
}
