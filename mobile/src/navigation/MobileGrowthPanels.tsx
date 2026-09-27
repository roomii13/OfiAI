/** @archivo MobileGrowthPanels.tsx @descripcion CRM y campanas desde controles nativos. */
import { useEffect,useState } from 'react';
import { Switch } from 'react-native';
import { useAuthMobile } from '../context/AuthContext';
import { useMobileResource } from '../lib/resources';
import { OText,OInput,OSelect,OButton,OItem,OState,confirmOperation,useOperationsAction } from './AgentOperationsUi';
import type { SalesDetail,SalesOverview,SalesLead } from '../../../shared/sales';
import type { MarketingCampaign,MarketingReport } from '../../../shared/marketing';
import { MobileMarketingEditor } from './MobileMarketingEditor';
/** Registro de necesidades y consentimiento o gestion administrativa del embudo. */
export function MobileSalesPanel() {
  const {usuario}=useAuthMobile();const admin=usuario?.rol==='admin';const [cursor,setCursor]=useState('');
  const me=useMobileResource<SalesDetail|null>(admin?null:'/sales/me');
  const crm=useMobileResource<SalesOverview>(admin?'/sales/leads'+(cursor?'?cursor='+cursor:''):null);
  const [leadId,setLeadId]=useState('');const detail=useMobileResource<SalesDetail>(leadId?'/sales/leads/'+leadId:null);
  const [need,setNeed]=useState('');const [volume,setVolume]=useState('1');const [consent,setConsent]=useState(false);
  const action=useOperationsAction(()=>{me.reload();crm.reload();detail.reload();});
  useEffect(()=>{if(me.data){setNeed(me.data.lead.need);setVolume(String(me.data.lead.expectedMonthlyVolume));setConsent(me.data.lead.consent);}},[me.data]);
  /** Confirma contacto y envia version, nunca estado libre. */
  function command(lead:SalesLead,value:string) {
    const execute=()=>{void action.run('/sales/leads/'+lead.id+'/commands',{version:lead.version,action:value});};
    if(value==='contact')confirmOperation('Enviar seguimiento interno a este usuario?',execute);else execute();
  }
  return <><OText title>{admin?'CRM':'Preferencias comerciales'}</OText><OButton label="Actualizar" icon="refresh-outline" onPress={()=>{me.reload();crm.reload();}}/>
    <OState loading={me.loading||crm.loading||detail.loading} error={me.error||crm.error||detail.error||action.error}/>
    {!admin?<>
      <OInput label="Que necesitas" value={need} onChange={setNeed} multiline max={2000}/>
      <OInput label="Volumen mensual previsto" value={volume} onChange={setVolume} numeric max={6}/>
      <OText>Autorizo recordatorios comerciales internos.</OText><Switch accessibilityLabel="Consentimiento comercial" value={consent} onValueChange={setConsent}/>
      <OButton label="Guardar preferencias" icon="save-outline" disabled={action.busy||me.loading||need.trim().length<3} onPress={()=>void action.run('/sales/me',{need,expectedMonthlyVolume:Number(volume),consent},'put')}/>
      {me.data&&<OText>Plan sugerido: {me.data.lead.assessment.recommendedPlan}</OText>}
    </>:<>
      <OText>Leads de esta pagina: {crm.data?.total??'Sin datos'}</OText>
      {crm.data?.leads.map(lead=><OItem key={lead.id}><OText title>{lead.name}</OText><OText>{lead.stage} · {lead.assessment.score}/100</OText>
        <OText>{lead.need}</OText><OText>{lead.assessment.nextAction}</OText><OText>Contacto {lead.consent?'autorizado':'no autorizado'}</OText>
        <OButton label="Historial" icon="time-outline" onPress={()=>setLeadId(lead.id)}/>
        <OSelect label="Accion" value="" onChange={value=>command(lead,value)} options={[
          {value:'qualify',label:'Calificar'},{value:'contact',label:'Enviar seguimiento'},{value:'interested',label:'Marcar interes'},
          {value:'trial',label:'En evaluacion'},{value:'sync',label:'Verificar conversion'},{value:'lost',label:'Marcar perdido'},{value:'recover',label:'Recuperar'}]}/>
      </OItem>)}
      {crm.data?.leads.length===0&&<OText>Sin leads registrados.</OText>}
      {cursor&&<OButton label="Primera pagina" onPress={()=>setCursor('')}/>}
      {crm.data?.nextCursor&&<OButton label="Siguiente pagina" icon="arrow-forward-outline" onPress={()=>setCursor(crm.data!.nextCursor!)}/>}
    </>}
    {(detail.data??me.data)?.interactions.map(item=><OText key={item.id}>{new Date(item.createdAt).toLocaleString()}: {item.message}</OText>)}
  </>;
}
/** Las mismas aprobaciones y estados de campana que en web. */
export function MobileMarketingPanel() {
  const campaigns=useMobileResource<MarketingCampaign[]>('/marketing');const [id,setId]=useState('');
  const detail=useMobileResource<{campaign:MarketingCampaign;reports:MarketingReport[]}>(id?'/marketing/'+id:null);
  const action=useOperationsAction(()=>{campaigns.reload();detail.reload();});
  const [name,setName]=useState('');const [hypothesis,setHypothesis]=useState('');
  const [audience,setAudience]=useState('empresa');const [channel,setChannel]=useState('in_app');const [objective,setObjective]=useState('activacion');
  /** Aprobacion explicita por el humano, no por el modelo generativo. */
  function command(value:string) {
    if(!detail.data)return;
    confirmOperation(value==='dispatch'?'Enviar el siguiente lote a usuarios con consentimiento?':'Confirmar cambio de la campana?',
      ()=>{void action.run('/marketing/'+id+'/commands',{version:detail.data!.campaign.version,action:value});});
  }
  return <><OText title>Marketing</OText><OButton label="Actualizar" icon="refresh-outline" onPress={campaigns.reload}/>
    <OInput label="Nombre de campana" value={name} onChange={setName} max={100}/>
    <OInput label="Hipotesis" value={hypothesis} onChange={setHypothesis} multiline max={1000}/>
    <OSelect label="Audiencia" value={audience} onChange={setAudience} options={[{value:'empresa',label:'Empresas'},{value:'profesional',label:'Profesionales'}]}/>
    <OSelect label="Objetivo" value={objective} onChange={setObjective} options={['activacion','retencion','recuperacion'].map(value=>({value,label:value}))}/>
    <OSelect label="Canal" value={channel} onChange={setChannel} options={['in_app','email','social','landing','seo'].map(value=>({value,label:value}))}/>
    <OButton label="Crear borrador" icon="add-outline" disabled={action.busy||name.length<3||hypothesis.length<5} onPress={()=>void action.run<MarketingCampaign>('/marketing',{
      name,hypothesis,audience,channel,objective,currency:'ARS',stages:['LEAD','QUALIFIED','CONTACTED','INTERESTED']}).then(value=>{if(value)setId(value.id);})}/>
    <OState loading={campaigns.loading||detail.loading} error={campaigns.error||detail.error||action.error}/>
    {campaigns.data?.map(campaign=><OItem key={campaign.id}><OText title>{campaign.name}</OText><OText>{campaign.status} · {campaign.channel} · {campaign.delivered} entregas</OText>
      <OButton label="Revisar contenido" onPress={()=>setId(campaign.id)}/></OItem>)}
    {detail.data&&<><OText title>{detail.data.campaign.name}</OText>
      {detail.data.campaign.variants.map(variant=><OItem key={variant.id}><OText title>{variant.id}: {variant.title}</OText><OText>{variant.body}</OText><OText>{variant.cta}</OText></OItem>)}
      <OButton label="Aprobar" disabled={action.busy} onPress={()=>command('approve')}/>
      <OButton label="Pausar" icon="pause-outline" disabled={action.busy} onPress={()=>command('pause')}/>
      <OButton label="Enviar lote" icon="send-outline" disabled={action.busy||detail.data.campaign.channel!=='in_app'||detail.data.campaign.status!=='approved'} onPress={()=>command('dispatch')}/>
      {detail.data.campaign.channel!=='in_app'&&<OText>Publicacion externa no conectada. Contenido en borrador.</OText>}
      <MobileMarketingEditor campaign={detail.data.campaign} onChanged={()=>{campaigns.reload();detail.reload();}}/>
      {detail.data.reports.map(report=><OText key={report.id}>{report.period} · {report.source} · CTR {report.metrics.ctr===null?'Sin datos':(report.metrics.ctr*100).toFixed(1)+'%'}</OText>)}
    </>}
  </>;
}
