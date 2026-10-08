/** @archivo SettlementPanels.tsx @descripcion Cobros, cuenta profesional y liquidacion manual compatibles con Expo 54. */
import { useState } from 'react';
import { ActivityIndicator,Linking,StyleSheet,Switch,Text,TextInput,View } from 'react-native';
import { useMobileResource } from '../lib/resources';
import { apiMobile } from '../lib/api';
import { coordinatorId } from '../lib/coordinator';
import { CoordinatorButton } from './CoordinatorUi';
import { useThemeMobile } from '../providers/theme';
import type { SettlementAccount,SettlementOverview,SettlementRow } from '../../../shared/settlements';
import type { ProtectedContractView,ContractEntry } from '../../../shared/protected-contract';
import type { ApiResult } from '../../../shared/contracts';
/** Formato monetario segun la moneda del acuerdo, sin conversiones locales. */
function money(row:SettlementRow,value:number|null):string {return value===null?'Sin confirmar':(value/10**row.minorDigits).toLocaleString('es-AR')+' '+row.currency;}
/** Lista operativa adaptable al telefono, consultada solo por OWNER autorizado. */
export function MobileSettlementsPanel() {
  const resource=useMobileResource<SettlementOverview>('/settlements');const { colores }=useThemeMobile();const [selected,setSelected]=useState<string|null>(null);
  const row=resource.data?.items.find(item=>item.jobId===selected);
  return <View style={s.section}><Text accessibilityRole="header" style={[s.heading,{color:colores.texto}]}>Cobros y liquidaciones</Text>
    {resource.loading&&<ActivityIndicator accessibilityLabel="Consultando cobros"/>}{!!resource.error&&<Text accessibilityRole="alert" style={{color:colores.texto}}>{resource.error}</Text>}
    <CoordinatorButton label="Actualizar cobros" icon="refresh" disabled={resource.loading} onPress={resource.reload}/>
    {row?<><CoordinatorButton label="Volver a cobros" icon="arrow-back" onPress={()=>setSelected(null)}/><MobileSettlementDetail key={row.jobId+':'+row.account?.version+':'+row.status} row={row} reload={resource.reload}/></>
      :resource.data?.items.map(item=><View key={item.jobId} style={[s.item,{borderColor:colores.borde}]}>
        <Text style={[s.heading,{color:colores.texto}]}>{item.professionalName}</Text><Text style={{color:colores.texto}}>Trabajo: {item.jobId}</Text>
        <Text style={{color:colores.texto}}>Profesional: {money(item,item.professionalTransferMinor)}</Text>
        <Text style={{color:colores.texto}}>OfiAI ({item.commissionBps/100}%): {money(item,item.ofiaiFeeMinor)}</Text>
        <Text style={{color:colores.texto}}>Cobrado: {money(item,item.collectedMinor)}</Text>
        <CoordinatorButton label="Ver cuenta y liquidacion" icon="wallet-outline" onPress={()=>setSelected(item.jobId)}/></View>)}
    {resource.data?.items.length===0&&<Text style={{color:colores.texto}}>No hay contrataciones con desglose registrado.</Text>}
  </View>;
}
/** Registro manual con UUID estable y confirmacion explicita; no ordena una transferencia bancaria. */
function MobileSettlementDetail({row,reload}:{row:SettlementRow;reload:()=>void}) {
  const {colores}=useThemeMobile();const [reason,setReason]=useState('');const [reference,setReference]=useState('');const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [key]=useState(coordinatorId);
  /** Recalculo, cuenta, permiso OWNER y sesion reciente se verifican en el servidor. */
  async function submit(verify:boolean):Promise<void>{if(busy||!row.account)return;setBusy(true);setMessage('');
    try{await apiMobile.post(verify?'/settlements/accounts/'+row.professionalUserId+'/verify':'/settlements/'+row.jobId+'/record-transfer',verify?
      {version:row.account.version,reason}:{idempotencyKey:key,accountVersion:row.account.version,reference,confirmTransferred:confirm});setMessage('Registro guardado.');reload();}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar.');}finally{setBusy(false);}}
  const amounts:Array<[string,number|null]>=[['Presupuesto',row.quoteMinor],['Comision OfiAI',row.ofiaiFeeMinor],['Procesamiento estimado',row.processingEstimatedMinor],
    ['Impuestos estimados',row.taxesEstimatedMinor],['Total del contratante',row.clientTotalMinor],['Cobrado',row.collectedMinor],['Costos reales del proveedor',row.providerCostsActualMinor],
    ['Neto acreditado',row.netReceivedMinor],['A transferir al profesional',row.professionalTransferMinor],['Neto real de OfiAI',row.ofiaiNetActualMinor],['Diferencia por cubrir',row.shortageMinor]];
  return <View style={s.section}><Text style={[s.heading,{color:colores.texto}]}>{row.professionalName}</Text>
    {amounts.map(([label,value])=><View key={label} style={s.line}><Text style={{color:colores.texto,flex:1}}>{label}</Text><Text style={{color:colores.texto,fontWeight:'600'}}>{money(row,value)}</Text></View>)}
    <Text style={{color:colores.texto}}>Cobro: {row.paymentStatus}</Text>
    <Text style={[s.heading,{color:colores.texto}]}>Cuenta de destino</Text>
    <Text selectable style={{color:colores.texto}}>{row.account?row.account.holder+'\n'+row.account.kind+': '+row.account.account:'Sin cuenta registrada'}</Text>
    {row.account&&!row.account.verified&&<><TextInput accessibilityLabel="Constancia de titularidad" placeholder="Constancia de titularidad" multiline value={reason} onChangeText={setReason} maxLength={500} style={[s.input,{color:colores.texto,borderColor:colores.borde}]}/>
      <CoordinatorButton label="Registrar verificacion" icon="checkmark-circle-outline" disabled={busy||reason.trim().length<10} onPress={()=>void submit(true)}/></>}
    {row.blockers.map(text=><Text key={text} style={{color:colores.texto}}>{text}</Text>)}
    {row.readyToTransfer&&<><TextInput accessibilityLabel="Referencia del comprobante" placeholder="Referencia del comprobante" value={reference} onChangeText={setReference} maxLength={120} style={[s.input,{color:colores.texto,borderColor:colores.borde}]}/>
      <View style={s.line}><Text style={{color:colores.texto,flex:1}}>Transferi {money(row,row.professionalTransferMinor)} y conserve {money(row,row.ofiaiFeeMinor)} de OfiAI.</Text><Switch value={confirm} onValueChange={setConfirm}/></View>
      <CoordinatorButton label="Registrar transferencia realizada" icon="save-outline" primary disabled={busy||!confirm||reference.trim().length<8} onPress={()=>void submit(false)}/></>}
    {row.transfer&&<Text style={{color:colores.texto}}>Registro manual: {row.transfer.reference}. No es confirmacion bancaria automatica.</Text>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:colores.texto}}>{message}</Text>}
  </View>;
}
/** Cuenta propia y privada; un cambio exige otra verificacion administrativa. */
export function MobileSettlementAccount() {
  const resource=useMobileResource<SettlementAccount|null>('/settlements/account');const {colores}=useThemeMobile();
  const [holder,setHolder]=useState('');const [account,setAccount]=useState('');const [cbu,setCbu]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  /** No se recibe UID, rol ni titularidad verificada desde el cliente. */
  async function save():Promise<void>{setBusy(true);setMessage('');try{await apiMobile.put('/settlements/account',{holder,account,kind:cbu?'cbu_cvu':'alias',currency:'ARS'});resource.reload();setMessage('Cuenta guardada. Pendiente de verificar.');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar.');}finally{setBusy(false);}}
  return <View style={s.section}><Text style={[s.heading,{color:colores.texto}]}>Cuenta para recibir pagos</Text>
    {!!resource.error&&<Text accessibilityRole="alert" style={{color:colores.texto}}>{resource.error}</Text>}
    {resource.data&&<Text style={{color:colores.texto}}>{resource.data.holder} · {resource.data.account} · {resource.data.verified?'Verificada':'Pendiente'}</Text>}
    <TextInput accessibilityLabel="Titular de la cuenta" placeholder="Titular de la cuenta" value={holder} onChangeText={setHolder} maxLength={150} style={[s.input,{color:colores.texto,borderColor:colores.borde}]}/>
    <View style={s.line}><Text style={{color:colores.texto}}>Usar CBU / CVU en lugar de alias</Text><Switch value={cbu} onValueChange={setCbu}/></View>
    <TextInput accessibilityLabel={cbu?'CBU o CVU':'Alias'} placeholder={cbu?'CBU / CVU':'Alias'} value={account} onChangeText={setAccount} maxLength={22} autoCapitalize="none" style={[s.input,{color:colores.texto,borderColor:colores.borde}]}/>
    <CoordinatorButton label="Guardar cuenta" icon="save-outline" disabled={busy||holder.trim().length<3||account.trim().length<6} onPress={()=>void save()}/>
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:colores.texto}}>{message}</Text>}
  </View>;
}
/** Desglose, aceptacion y reclamos del mismo expediente utilizado por la web. */
export function MobileContractAgreement({jobId,role}:{jobId:string;role:'empresa'|'profesional'}) {
  const path='/jobs/'+encodeURIComponent(jobId)+'/contract';const resource=useMobileResource<ProtectedContractView|null>(path);const c=resource.data;
  const entries=useMobileResource<ContractEntry[]>(c?.dispute?path+'/entries':null);const {colores}=useThemeMobile();
  const [consent,setConsent]=useState(false);const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [pending,setPending]=useState<{url:string;body:unknown}|null>(null);
  /** Mismo cuerpo e identificador ante errores de red; no calcula importes en Expo. */
  async function send(url:string,body:unknown):Promise<void>{if(busy)return;setBusy(true);setMessage('');setPending({url,body});
    try{const response=await apiMobile.post<ApiResult<{url?:string}>>(url,body);if(response.datos?.url)await Linking.openURL(response.datos.url);setPending(null);resource.reload();entries.reload();setText('');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo confirmar.');}finally{setBusy(false);}}
  /** Solo comandos reconocidos por el servidor. */
  function command(action:'accept_terms'|'message'|'open_dispute'):void{if(!c)return;void send(path+'/commands',{revision:c.revision,idempotencyKey:coordinatorId(),action,
    ...(action==='accept_terms'?{termsVersion:c.breakdown.termsVersion,acknowledge:true}:action==='message'?{text}:{reason:text})});}
  const b=c?.breakdown;
  return <View style={s.section}><Text style={[s.heading,{color:colores.texto}]}>Expediente y desglose</Text>
    {resource.loading&&<ActivityIndicator/>}{!!resource.error&&<Text accessibilityRole="alert" style={{color:colores.texto}}>{resource.error}</Text>}
    {resource.data===null&&role==='empresa'&&<CoordinatorButton label="Revisar desglose" icon="document-text-outline" disabled={busy||!!pending} onPress={()=>void send(path,{})}/>}
    {c&&b&&<>{[['Profesional',b.professionalMinor],['OfiAI ('+b.commissionBps/100+'%)',b.commissionMinor],['Procesamiento estimado',b.processingMinor],['Impuestos estimados',b.taxMinor+b.withholdingMinor],['Total',b.clientTotalMinor]].map(([label,amount])=>
      <Text key={String(label)} style={{color:colores.texto}}>{label}: {(Number(amount)/10**b.minorDigits).toLocaleString('es-AR')} {b.currency}</Text>)}
      <Text style={{color:colores.texto}}>Cobro: {c.financialState==='UNPAID'?'Sin pago registrado':c.financialState}</Text>
      {!b.chargesVerified&&<Text style={{color:colores.texto}}>Costos del proveedor pendientes de confirmar. El total es estimado.</Text>}
      {role==='empresa'&&!c.acceptedAt&&<><CoordinatorButton label="Actualizar desglose" icon="refresh" disabled={busy||!!pending} onPress={()=>void send(path,{})}/>
        <View style={s.line}><Text style={{color:colores.texto,flex:1}}>Acepto el desglose y la comision adicional de OfiAI.</Text><Switch value={consent} onValueChange={setConsent}/></View>
        <CoordinatorButton label="Confirmar desglose" icon="checkmark" disabled={busy||!!pending||!consent||!b.chargesVerified} onPress={()=>command('accept_terms')}/></>}
      {role==='empresa'&&c.acceptedAt&&c.financialState==='UNPAID'&&<CoordinatorButton label="Pagar con Mercado Pago" icon="card-outline" disabled={busy||!!pending||!c.collectionEnabled} onPress={()=>void send('/settlements/'+encodeURIComponent(jobId)+'/checkout',{})}/>}
      <Text style={{color:colores.texto}}>Profesional: {c.professionalCompletedAt?'Finalizacion confirmada':'Confirmacion pendiente'}. Contratante: {c.clientApprovedAt?'Conformidad confirmada':'Conformidad pendiente'}.</Text>
      <Text style={[s.heading,{color:colores.texto}]}>{c.dispute?'Reclamo: '+c.dispute.state:'Reportar problema'}</Text>
      {c.dispute&&<Text style={{color:colores.texto}}>{c.dispute.reason}</Text>}
      {entries.data?.map(entry=><Text key={entry.id} style={{color:colores.texto}}>{entry.actorRole}: {entry.text}</Text>)}
      <TextInput accessibilityLabel={c.dispute?'Mensaje del reclamo':'Motivo del reclamo'} multiline value={text} onChangeText={setText} maxLength={2000} style={[s.input,{color:colores.texto,borderColor:colores.borde}]}/>
      <CoordinatorButton label={c.dispute?'Enviar mensaje':'Abrir reclamo'} icon="chatbubble-outline" disabled={busy||!!pending||text.trim().length<10} onPress={()=>command(c.dispute?'message':'open_dispute')}/>
    </>}
    {pending&&<><CoordinatorButton label="Reintentar misma solicitud" icon="refresh" disabled={busy} onPress={()=>void send(pending.url,pending.body)}/>
      <CoordinatorButton label="Consultar estado" icon="sync-outline" disabled={busy} onPress={()=>{setPending(null);resource.reload();}}/></>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:colores.texto}}>{message}</Text>}
  </View>;
}
const s=StyleSheet.create({section:{gap:12,paddingVertical:18},heading:{fontSize:18,fontWeight:'600'},item:{borderBottomWidth:1,gap:8,paddingVertical:14},
  line:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10},input:{minHeight:48,borderWidth:1,borderRadius:6,padding:12,fontSize:16}});
