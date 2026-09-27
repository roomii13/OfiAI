/** @archivo MobileIntelligencePanels.tsx @descripcion Evidencia, ejecuciones y telemetria en telefono. */
import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuthMobile } from '../context/AuthContext';
import { useMobileResource,metricLabel } from '../lib/resources';
import { OText,OInput,OSelect,OButton,OItem,OState,useOperationsAction } from './AgentOperationsUi';
import type { IntelligenceSnapshot,IntelligenceAnswer,IntelligenceFact } from '../../../shared/intelligence';
import type { AgentRun } from '../../../shared/orchestrator';
/** Metrica legible con moneda y origen, incluyendo ausencia de evidencia. */
function MobileFact({fact}:{fact:IntelligenceFact}) {
  return <OItem><OText>{fact.label}</OText><OText title>{fact.value===null?'Sin datos':typeof fact.value==='number'?fact.value.toLocaleString():fact.value} {fact.currency??''}</OText>
    {fact.note&&<OText>{fact.note}</OText>}<OText>Fuente: {fact.source}</OText></OItem>;
}
/** Preguntas sobre la misma evidencia que se muestra en web. */
export function MobileIntelligencePanel() {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));const snapshot=useMobileResource<IntelligenceSnapshot>(/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?'/intelligence?month='+month:null);
  const [question,setQuestion]=useState('');const [answer,setAnswer]=useState<IntelligenceAnswer|null>(null);const action=useOperationsAction();
  return <><OText title>Inteligencia de negocio</OText><OButton label="Actualizar" icon="refresh-outline" onPress={snapshot.reload}/>
    <OInput label="Mes (AAAA-MM)" value={month} onChange={setMonth} max={7}/>
    <OInput label="Tu pregunta" value={question} onChange={setQuestion} multiline max={1000}/>
    <OButton label="Consultar" icon="send-outline" disabled={action.busy||question.length<3} onPress={()=>void action.run<IntelligenceAnswer>('/intelligence/questions',{question,month}).then(value=>{if(value)setAnswer(value);})}/>
    <OState loading={snapshot.loading} error={snapshot.error||action.error}/>
    {answer&&<><OText title>{answer.question}</OText><OText>{answer.answer}</OText>{answer.facts.map(fact=><MobileFact key={fact.id} fact={fact}/>)}
      <OText>{answer.limitations.join(' ')}</OText></>}
    {snapshot.data&&<><OText title>Indicadores</OText>{snapshot.data.facts.map(fact=><MobileFact key={fact.id} fact={fact}/>)}
      {snapshot.data.partial&&<OText>Datos parciales por limite de lectura.</OText>}
      <OText title>Categorias</OText>{snapshot.data.categories.map(item=><OText key={item.name}>{item.name}: {item.jobs} solicitudes · {item.completed} completadas</OText>)}
      <OText title>Ciudades</OText>{snapshot.data.cities.map(item=><OText key={item.name}>{item.name}: {item.demand} solicitudes · {item.supply??'Sin datos'} perfiles disponibles</OText>)}
      <OText title>Fechas a revisar</OText>{snapshot.data.delayed.map(item=><OText key={item.jobId}>{item.title}: {item.reason}</OText>)}
    </>}
  </>;
}
/** Inicia recorridos acotados sin confirmar contrataciones. */
export function MobileRunsPanel() {
  const {usuario}=useAuthMobile();const runs=useMobileResource<AgentRun[]>('/agents/runs');const [event,setEvent]=useState('business.review');
  const [resourceId,setResourceId]=useState('');const action=useOperationsAction(runs.reload);
  return <><OText title>Ejecuciones</OText><OButton label="Actualizar" icon="refresh-outline" onPress={runs.reload}/>
    <OSelect label="Recorrido" value={event} onChange={setEvent} options={[{value:'business.review',label:'Analisis de negocio'},
      ...(usuario?.rol==='empresa'?[{value:'job.review',label:'Revisar trabajo'}]:[]),...(usuario?.rol==='admin'?[{value:'sales.review',label:'Calificar lead'}]:[])]}/>
    {event!=='business.review'&&<OInput label="Identificador" value={resourceId} onChange={setResourceId} max={128}/>}
    <OButton label={action.busy?'Ejecutando...':'Ejecutar'} icon="play-outline" disabled={action.busy} onPress={()=>void action.run('/agents/runs',{event,requestId:randomUUID(),...(resourceId?{resourceId}:{})})}/>
    <OState loading={runs.loading} error={runs.error||action.error}/>
    {runs.data?.map(run=><OItem key={run.id}><OText title>{run.event} · {run.status}</OText><OText>{run.message}</OText>
      {run.steps.map((step,index)=><OText key={index}>{step.agent} / {step.tool}: {step.status} · {step.attempts} intento(s)</OText>)}</OItem>)}
    {runs.data?.length===0&&<OText>No hay ejecuciones.</OText>}
  </>;
}
interface Governance {scope:string;metrics:Record<string,number|null>;observations:Array<{id:string;agent:string;status:string;durationMs:number;estimatedCostUsd:number|null;fallbackReason:string|null}>;}
/** Gobierno IA con costos desconocidos visibles y revision humana. */
export function MobileGovernancePanel() {
  const data=useMobileResource<Governance>('/governance');const action=useOperationsAction(data.reload);
  return <><OText title>Gobierno IA</OText><OButton label="Actualizar" icon="refresh-outline" onPress={data.reload}/>
    <OState loading={data.loading} error={data.error||action.error}/><OText>{data.data?.scope}</OText>
    {Object.entries(data.data?.metrics??{}).map(([label,value])=><OText key={label}>{metricLabel(label)}: {value===null?'No medido':value.toLocaleString()}</OText>)}
    {data.data?.observations.map(row=><OItem key={row.id}><OText title>{row.agent} · {row.status}</OText><OText>{row.durationMs} ms · USD estimados {row.estimatedCostUsd===null?'no disponible':row.estimatedCostUsd.toFixed(6)}</OText>
      {row.fallbackReason&&<OText>Fallback: {row.fallbackReason}</OText>}
      <OSelect label="Revision humana" value="" onChange={verdict=>void action.run('/governance/'+row.id+'/reviews',{verdict})}
        options={[{value:'acceptable',label:'Aceptable'},{value:'suspected_hallucination',label:'Posible alucinacion'},{value:'confirmed_issue',label:'Problema confirmado'}]}/>
    </OItem>)}
  </>;
}
