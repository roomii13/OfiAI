/** @archivo GrowthPanels.tsx @descripcion CRM consentido y campanas con aprobacion explicita. */
import { useEffect,useState } from 'react';
import { Send,Save,Check,Pause } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import { AgentRefresh,AgentState,useAgentAction } from './AgentWorkspace';
import type { SalesDetail,SalesOverview,SalesLead } from '../../../shared/sales';
import type { MarketingCampaign,MarketingReport } from '../../../shared/marketing';
import { MarketingEditor } from './MarketingEditor';
const stages: Record<string,string>={LEAD:'Nuevo',QUALIFIED:'Calificado',CONTACTED:'Contactado',INTERESTED:'Interesado',TRIAL:'Evaluacion',CUSTOMER:'Cliente',LOST:'Perdido'};
/** Cuenta propia y CRM administrativo consumen endpoints separados. */
export function SalesPanel() {
  const {role}=useAuth(); const [cursor,setCursor]=useState('');
  const me=useApiResource<SalesDetail|null>(role==='admin'?null:'/sales/me');
  const crm=useApiResource<SalesOverview>(role==='admin'?'/sales/leads'+(cursor?'?cursor='+cursor:''):null);
  const [selected,setSelected]=useState<string|null>(null);
  const detail=useApiResource<SalesDetail>(selected?'/sales/leads/'+selected:null);
  const [need,setNeed]=useState('');const [volume,setVolume]=useState('1');const [consent,setConsent]=useState(false);
  const action=useAgentAction(()=>{me.reload();crm.reload();detail.reload();});
  useEffect(()=>{if(me.data){setNeed(me.data.lead.need);setVolume(String(me.data.lead.expectedMonthlyVolume));setConsent(me.data.lead.consent);}},[me.data]);
  /** Las acciones de contacto requieren confirmacion y version actual. */
  async function command(lead:SalesLead,value:string) {
    if(value==='contact'&&!window.confirm('Enviar un mensaje interno a esta cuenta?'))return;
    await action.run('/sales/leads/'+lead.id+'/commands',{version:lead.version,action:value});
  }
  return <><div className="agent-row"><h2>{role==='admin'?'CRM comercial':'Preferencias comerciales'}</h2><AgentRefresh onClick={()=>{crm.reload();me.reload();}}/></div>
    <AgentState loading={me.loading||crm.loading} error={me.error||crm.error||action.notice}/>
    {role!=='admin'?<form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run('/sales/me',{need,expectedMonthlyVolume:Number(volume),consent},'put');}}>
      <label>Que necesitas resolver<textarea required minLength={3} maxLength={2000} value={need} onChange={e=>setNeed(e.target.value)}/></label>
      <label>{role==='empresa'?'Trabajos previstos por mes':'Propuestas previstas por mes'}<input type="number" min="0" max="100000" required value={volume} onChange={e=>setVolume(e.target.value)}/></label>
      <label className="agent-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo recordatorios comerciales internos. Puedo retirarlo cuando quiera.</label>
      <button className="ofi-btn-primary" disabled={action.busy||me.loading}><Save size={17}/>Guardar preferencias</button>
      {me.data&&<p>Plan sugerido: {me.data.lead.assessment.recommendedPlan}. <a href="/subscriptions">Ver planes</a></p>}
    </form>:<>
      <div className="agent-metrics">{Object.entries(crm.data?.stages??{}).map(([stage,total])=><div className="agent-metric" key={stage}>{stages[stage]}<strong>{total}</strong></div>)}</div>
      <p className="agent-muted">Metricas de esta pagina. Conversion a cliente: {crm.data?.conversionRate==null?'Sin datos':(crm.data.conversionRate*100).toFixed(1)+'%'}.</p>
      <div className="agent-list">{crm.data?.leads.map(lead=><article className="agent-item" key={lead.id}>
        <div className="agent-row"><h3>{lead.name}</h3><span>{stages[lead.stage]}</span><strong>{lead.assessment.score}/100</strong></div>
        <p>{lead.need}</p><p>{lead.companyName??lead.audience} · {lead.city??'Sin ciudad'} · Contacto: {lead.consent?'autorizado':'no autorizado'}</p>
        <p>{lead.assessment.nextAction}</p>
        <div className="agent-row"><button className="ofi-btn-secondary" onClick={()=>setSelected(lead.id)}>Historial</button>
          <select aria-label={'Accion para '+lead.name} value="" disabled={action.busy} onChange={e=>void command(lead,e.target.value)}>
            <option value="">Accion comercial</option>
            {[['qualify','Calificar'],['contact','Enviar seguimiento'],['interested','Marcar interes'],['trial','En evaluacion'],['sync','Verificar conversion'],['lost','Marcar perdido'],['recover','Recuperar']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></div>
      </article>)}</div>
      {crm.data?.leads.length===0&&<p>No hay consultas comerciales registradas.</p>}
      <div className="agent-row">{cursor&&<button className="ofi-btn-secondary" onClick={()=>setCursor('')}>Primera pagina</button>}
        {crm.data?.nextCursor&&<button className="ofi-btn-secondary" onClick={()=>setCursor(crm.data!.nextCursor!)}>Siguiente pagina</button>}</div>
    </>}
    <AgentState loading={detail.loading} error={detail.error}/>
    {(detail.data??me.data)?.interactions.map(item=><p key={item.id} className="agent-muted">{new Date(item.createdAt).toLocaleString()} · {item.message}</p>)}
  </>;
}
/** Campanas en borrador antes de cualquier aprobacion o envio. */
export function MarketingPanel() {
  const campaigns=useApiResource<MarketingCampaign[]>('/marketing');const [id,setId]=useState('');
  const detail=useApiResource<{campaign:MarketingCampaign;reports:MarketingReport[]}>(id?'/marketing/'+id:null);
  const action=useAgentAction(()=>{campaigns.reload();detail.reload();});
  const [name,setName]=useState('');const [hypothesis,setHypothesis]=useState('');
  const [audience,setAudience]=useState('empresa');const [channel,setChannel]=useState('in_app');const [objective,setObjective]=useState('activacion');
  /** Version y aprobacion se comprueban de nuevo en el servidor. */
  async function command(campaign:MarketingCampaign,value:string) {
    if(value!=='pause'&&!window.confirm(value==='approve'?'Aprobar estas variantes?':'Enviar el siguiente lote interno a usuarios con consentimiento?'))return;
    await action.run('/marketing/'+campaign.id+'/commands',{version:campaign.version,action:value});
  }
  return <><div className="agent-row"><h2>Campanas</h2><AgentRefresh onClick={campaigns.reload}/></div>
    <form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run<MarketingCampaign>('/marketing',{name,hypothesis,audience,channel,objective,
      currency:'ARS',stages:['LEAD','QUALIFIED','CONTACTED','INTERESTED']}).then(value=>{if(value)setId(value.id);});}}>
      <label>Nombre<input required minLength={3} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Hipotesis<textarea required minLength={5} maxLength={1000} value={hypothesis} onChange={e=>setHypothesis(e.target.value)}/></label>
      <div className="agent-grid"><label>Audiencia<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="empresa">Empresas</option><option value="profesional">Profesionales</option></select></label>
      <label>Objetivo<select value={objective} onChange={e=>setObjective(e.target.value)}><option value="activacion">Activacion</option><option value="retencion">Retencion</option><option value="recuperacion">Recuperacion</option></select></label></div>
      <label>Canal<select value={channel} onChange={e=>setChannel(e.target.value)}>{['in_app','email','social','landing','seo'].map(value=><option key={value}>{value}</option>)}</select></label>
      <button disabled={action.busy} className="ofi-btn-primary"><Save size={17}/>Crear borrador</button>
    </form>
    <AgentState loading={campaigns.loading||detail.loading} error={campaigns.error||detail.error||action.notice}/>
    <div className="agent-list">{campaigns.data?.map(campaign=><article className="agent-item" key={campaign.id}>
      <h3>{campaign.name}</h3><p>{campaign.status} · {campaign.channel} · {campaign.delivered} entregas internas</p>
      <button className="ofi-btn-secondary" onClick={()=>setId(campaign.id)}>Revisar contenido</button>
    </article>)}</div>
    {campaigns.data?.length===0&&<p>No hay campanas.</p>}
    {detail.data&&<section className="agent-section"><h3>{detail.data.campaign.name}</h3>
      <div className="agent-grid">{detail.data.campaign.variants.map(variant=><article className="agent-item" key={variant.id}><h3>Variante {variant.id}: {variant.title}</h3><p>{variant.body}</p><p>{variant.cta}</p></article>)}</div>
      <div className="agent-row">
        <button disabled={action.busy} className="ofi-btn-secondary" onClick={()=>void command(detail.data!.campaign,'approve')}><Check size={17}/>Aprobar</button>
        <button disabled={action.busy} className="ofi-btn-secondary" onClick={()=>void command(detail.data!.campaign,'pause')}><Pause size={17}/>Pausar</button>
        <button disabled={action.busy||detail.data.campaign.channel!=='in_app'||detail.data.campaign.status!=='approved'} className="ofi-btn-primary" onClick={()=>void command(detail.data!.campaign,'dispatch')}><Send size={17}/>Enviar lote</button>
      </div>
      {detail.data.campaign.channel!=='in_app'&&<p className="agent-muted">Publicacion externa no conectada. Contenido en borrador.</p>}
      <MarketingEditor campaign={detail.data.campaign} onChanged={()=>{campaigns.reload();detail.reload();}}/>
      {detail.data.reports.map(report=><p key={report.id}>{report.period} · Variante {report.variantId} · CTR {report.metrics.ctr===null?'Sin datos':(report.metrics.ctr*100).toFixed(1)+'%'} · Fuente declarada: {report.source}</p>)}
    </section>}
  </>;
}
