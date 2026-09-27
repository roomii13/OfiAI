/** @archivo MarketingEditor.tsx @descripcion Revision humana de variantes y carga explicita de evidencia. */
import { useEffect,useState } from 'react';
import { Save } from 'lucide-react';
import type { MarketingCampaign } from '../../../shared/marketing';
import { useApiResource } from '../lib/api/resources';
import { AgentState,useAgentAction } from './AgentWorkspace';
const fields=[['impressions','Impresiones'],['clicks','Clics'],['conversions','Conversiones'],['acquiredCustomers','Clientes adquiridos'],
  ['spendMinor','Inversion en centavos'],['attributedRevenueMinor','Ingreso atribuido en centavos'],['activeAtStart','Activos iniciales'],['retained','Retenidos'],['churned','Bajas']] as const;
/** Editar vuelve la campana a borrador y exige una nueva aprobacion. */
export function MarketingEditor({campaign,onChanged}:{campaign:MarketingCampaign;onChanged:()=>void}) {
  const [variants,setVariants]=useState(campaign.variants);const action=useAgentAction(onChanged);
  const [source,setSource]=useState('');const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));const [variantId,setVariantId]=useState('A');
  const [values,setValues]=useState<Record<string,string>>({});const [attested,setAttested]=useState(false);
  const insights=useApiResource<{nextAction:string;market:Array<{name:string;jobs:number}>;limitations:string[]}>('/marketing/'+campaign.id+'/insights');
  useEffect(()=>setVariants(campaign.variants),[campaign.id,campaign.version,campaign.variants]);
  return <section className="agent-section"><h3>Revision de contenido</h3>
    <AgentState error={action.notice||insights.error} loading={insights.loading}/>
    <form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run('/marketing/'+campaign.id+'/content',{version:campaign.version,variants});}}>
      {variants.map((variant,index)=><fieldset key={variant.id} className="agent-form"><legend>Variante {variant.id}</legend>
        {(['title','body','cta'] as const).map(key=><label key={key}>{{title:'Titulo',body:'Mensaje',cta:'Llamado a la accion'}[key]}
          <textarea required minLength={key==='body'?10:3} maxLength={key==='body'?1500:key==='title'?120:100} value={variant[key]}
            onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,[key]:e.target.value}:item))}/></label>)}</fieldset>)}
      <button className="ofi-btn-secondary" disabled={action.busy||campaign.delivered>0||campaign.status==='completed'}><Save size={17}/>Guardar borrador</button>
    </form>
    <details><summary>Registrar evidencia de campana</summary>
      <form className="agent-form" onSubmit={e=>{e.preventDefault();if(!attested)return;void action.run('/marketing/'+campaign.id+'/reports',{
        id:crypto.randomUUID(),variantId,source,period,currency:campaign.currency,...Object.fromEntries(fields.map(([key])=>[key,Number(values[key])]))});}}>
        <label>Fuente del reporte<input required minLength={3} maxLength={200} value={source} onChange={e=>setSource(e.target.value)}/></label>
        <label>Periodo<input required type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
        <label>Variante<select value={variantId} onChange={e=>setVariantId(e.target.value)}><option>A</option><option>B</option></select></label>
        <div className="agent-grid">{fields.map(([key,label])=><label key={key}>{label}<input required type="number" min={0} max={1000000000} step={1} value={values[key]??''}
          onChange={e=>setValues(current=>({...current,[key]:e.target.value}))}/></label>)}</div>
        <label className="agent-check"><input required type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>Confirmo que estos datos provienen de la fuente indicada.</label>
        <button className="ofi-btn-primary" disabled={action.busy||!attested}><Save size={17}/>Registrar reporte</button>
      </form>
    </details>
    {insights.data&&<><h3>Analisis de adquisicion</h3><p>{insights.data.nextAction}</p>
      {insights.data.market.map(row=><p key={row.name}>{row.name}: {row.jobs} solicitudes observadas</p>)}
      {insights.data.limitations.map(note=><p className="agent-muted" key={note}>{note}</p>)}</>}
  </section>;
}
