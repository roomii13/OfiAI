/** @archivo MobileMarketingEditor.tsx @descripcion Edicion y evidencia de campanas con controles nativos. */
import { Fragment,useEffect,useState } from 'react';
import { Switch } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { MarketingCampaign } from '../../../shared/marketing';
import { useMobileResource } from '../lib/resources';
import { OText,OInput,OSelect,OButton,OState,useOperationsAction } from './AgentOperationsUi';
const fields=[['impressions','Impresiones'],['clicks','Clics'],['conversions','Conversiones'],['acquiredCustomers','Clientes adquiridos'],
  ['spendMinor','Inversion en centavos'],['attributedRevenueMinor','Ingreso atribuido en centavos'],['activeAtStart','Activos iniciales'],['retained','Retenidos'],['churned','Bajas']] as const;
/** Importacion declarada, distinguida de ingresos verificados por Mercado Pago. */
export function MobileMarketingEditor({campaign,onChanged}:{campaign:MarketingCampaign;onChanged:()=>void}) {
  const [variants,setVariants]=useState(campaign.variants);const [edit,setEdit]=useState(false);const [report,setReport]=useState(false);
  const [source,setSource]=useState('');const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));const [variantId,setVariantId]=useState('A');
  const [values,setValues]=useState<Record<string,string>>({});const [attested,setAttested]=useState(false);
  const action=useOperationsAction(onChanged);
  const insights=useMobileResource<{nextAction:string;market:Array<{name:string;jobs:number}>;limitations:string[]}>('/marketing/'+campaign.id+'/insights');
  useEffect(()=>setVariants(campaign.variants),[campaign.id,campaign.version]);
  return <><OButton label={edit?'Cerrar edicion':'Editar contenido'} icon="create-outline" onPress={()=>setEdit(!edit)}/>
    {edit&&<>{variants.map((variant,index)=><Fragment key={variant.id}><OText title>Variante {variant.id}</OText>
      {(['title','body','cta'] as const).map(key=><OInput key={variant.id+key} label={{title:'Titulo',body:'Mensaje',cta:'Llamado a la accion'}[key]} value={variant[key]}
        multiline={key==='body'} max={key==='body'?1500:key==='title'?120:100}
        onChange={value=>setVariants(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item))}/>)}</Fragment>)}
      <OButton label="Guardar borrador" icon="save-outline" disabled={action.busy||campaign.delivered>0||campaign.status==='completed'}
        onPress={()=>void action.run('/marketing/'+campaign.id+'/content',{version:campaign.version,variants})}/></>}
    <OButton label={report?'Cerrar reporte':'Registrar evidencia'} icon="document-text-outline" onPress={()=>setReport(!report)}/>
    {report&&<><OInput label="Fuente del reporte" value={source} onChange={setSource} max={200}/>
      <OInput label="Periodo AAAA-MM" value={period} onChange={setPeriod} max={7}/>
      <OSelect label="Variante" value={variantId} onChange={setVariantId} options={[{value:'A',label:'A'},{value:'B',label:'B'}]}/>
      {fields.map(([key,label])=><OInput key={key} label={label} value={values[key]??''} numeric max={10} onChange={value=>setValues(current=>({...current,[key]:value}))}/>)}
      <OText>Confirmo que los datos provienen de la fuente indicada.</OText><Switch value={attested} onValueChange={setAttested} accessibilityLabel="Confirmar procedencia"/>
      <OButton label="Registrar reporte" icon="save-outline" disabled={action.busy||!attested||source.length<3||fields.some(([key])=>!values[key]?.trim())}
        onPress={()=>void action.run('/marketing/'+campaign.id+'/reports',{id:randomUUID(),variantId,source,period,currency:campaign.currency,
          ...Object.fromEntries(fields.map(([key])=>[key,Number(values[key])]))})}/></>}
    <OState loading={insights.loading} error={insights.error||action.error}/>
    {insights.data&&<><OText title>Analisis de adquisicion</OText><OText>{insights.data.nextAction}</OText>
      {insights.data.market.map(row=><OText key={row.name}>{row.name}: {row.jobs} solicitudes observadas</OText>)}
      {insights.data.limitations.map(note=><OText key={note}>{note}</OText>)}</>}
  </>;
}
