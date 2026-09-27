/** @archivo MobileSupportPanels.tsx @descripcion Soporte y conocimiento con controles nativos y ownership backend. */
import { useRef,useState } from 'react';
import { Switch } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useAuthMobile } from '../context/AuthContext';
import { useMobileResource } from '../lib/resources';
import { OText,OInput,OSelect,OButton,OItem,OState,confirmOperation,useOperationsAction } from './AgentOperationsUi';
import type { SupportSession,SupportTicket } from '../../../shared/support';
import type { KnowledgeDocument,KnowledgeSearch } from '../../../shared/knowledge';
/** Conversaciones persistentes con opcion de escalamiento humano. */
export function MobileSupportPanel() {
  const {usuario}=useAuthMobile();const [id,setId]=useState('');const [tool,setTool]=useState('');const [resourceId,setResourceId]=useState('');
  const sessions=useMobileResource<SupportSession[]>('/support/sessions');
  const current=useMobileResource<SupportSession>(id?'/support/sessions/'+id:null);
  const [message,setMessage]=useState('');const pending=useRef<{id:string;text:string}|null>(null);
  const tickets=useMobileResource<SupportTicket[]>(usuario?.rol==='admin'?'/support/tickets':null);
  const [ticketId,setTicketId]=useState('');const [humanMessage,setHumanMessage]=useState('');
  const ticket=useMobileResource<{ticket:SupportTicket;session:SupportSession}>(ticketId?'/support/tickets/'+ticketId:null);
  const action=useOperationsAction(()=>{sessions.reload();current.reload();tickets.reload();ticket.reload();});
  /** No crea un contexto que el usuario no pueda consultar. */
  async function start() {
    const value=await action.run<SupportSession>('/support/sessions',{resource:tool?{tool,...(tool==='getSubscription'?{}:{id:resourceId})}:null});
    if(value){setId(value.id);setMessage('');pending.current=null;}
  }
  /** Retiene requestId cuando falla la red para que el servidor deduplique. */
  async function send() {
    if(!current.data||!message.trim())return;
    if(pending.current?.text!==message)pending.current={id:randomUUID(),text:message};
    const value=await action.run('/support/sessions/'+id+'/messages',{message,version:current.data.version,requestId:pending.current.id});
    if(value){setMessage('');pending.current=null;}
  }
  /** Respuesta humana auditada, con confirmacion antes de cerrar un caso. */
  function ticketCommand(value:string) {
    if(!ticket.data)return;
    const execute=()=>{void action.run('/support/tickets/'+ticketId+'/commands',{action:value,version:ticket.data!.ticket.version,...(value==='reply'?{message:humanMessage}:{})});};
    if(value==='resolve')confirmOperation('Resolver este caso?',execute);else execute();
  }
  return <><OText title>Soporte</OText><OButton label="Actualizar" icon="refresh-outline" onPress={()=>{sessions.reload();current.reload();tickets.reload();}}/>
    <OSelect label="Contexto" value={tool} onChange={setTool} options={[{value:'',label:'Consulta general'},{value:'getJob',label:'Un trabajo'},
      {value:'getSubscription',label:'Mi suscripcion'},{value:'getInvoice',label:'Un recibo'},{value:'getProfessional',label:'Un profesional'}]}/>
    {!!tool&&tool!=='getSubscription'&&<OInput label="Identificador" value={resourceId} onChange={setResourceId} max={128}/>}
    <OButton label="Nueva conversacion" icon="add-outline" disabled={action.busy} onPress={()=>void start()}/>
    <OState loading={sessions.loading||current.loading} error={sessions.error||current.error||action.error}/>
    <OSelect label="Conversaciones" value={id} onChange={value=>{setId(value);setMessage('');pending.current=null;}}
      options={(sessions.data??[]).map(item=>({value:item.id,label:new Date(item.createdAt).toLocaleString()+' · '+item.status}))}/>
    {sessions.data?.length===0&&<OText>No hay conversaciones.</OText>}
    {current.data&&<>
      {current.data.messages.map(item=><OItem key={item.id}><OText title>{item.author==='user'?'Vos':item.author==='human'?'Equipo OfiAI':'Soporte OfiAI'}</OText>
        <OText>{item.text}</OText>{!!item.sources.length&&<OText>Fuentes: {item.sources.join(', ')}</OText>}</OItem>)}
      <OInput label="Mensaje" value={message} onChange={setMessage} multiline/>
      <OButton label={action.busy?'Procesando...':'Enviar'} icon="send-outline" disabled={action.busy||!message.trim()||current.data.status==='resolved'} onPress={()=>void send()}/>
    </>}
    {usuario?.rol==='admin'&&<>
      <OText title>Atencion humana</OText><OState loading={tickets.loading||ticket.loading} error={tickets.error||ticket.error}/>
      {tickets.data?.map(item=><OItem key={item.id}><OText>{item.category} · {item.priority} · {item.status}</OText><OButton label="Abrir caso" onPress={()=>setTicketId(item.id)}/></OItem>)}
      {ticket.data&&<>
        {ticket.data.session.messages.map(item=><OText key={item.id}>{item.author}: {item.text}</OText>)}
        <OInput label="Respuesta humana" value={humanMessage} onChange={setHumanMessage} multiline/>
        <OButton label="Tomar caso" disabled={action.busy||ticket.data.ticket.status==='resolved'} onPress={()=>ticketCommand('claim')}/>
        <OButton label="Responder" icon="send-outline" disabled={action.busy||!humanMessage.trim()||ticket.data.ticket.status==='resolved'} onPress={()=>ticketCommand('reply')}/>
        <OButton label="Resolver" disabled={action.busy||ticket.data.ticket.status==='resolved'} onPress={()=>ticketCommand('resolve')}/>
      </>}
    </>}
  </>;
}
/** Almacenamiento explicito de preferencias y procedimientos; nunca captura silenciosa. */
export function MobileKnowledgePanel() {
  const {usuario}=useAuthMobile();const [scope,setScope]=useState('private');const [jobId,setJobId]=useState('');
  const docs=useMobileResource<{documents:KnowledgeDocument[];partial:boolean}>(scope==='job'&&!jobId?null:'/knowledge?scope='+scope+(jobId?'&jobId='+encodeURIComponent(jobId):''));
  const [title,setTitle]=useState('');const [text,setText]=useState('');const [kind,setKind]=useState('preference');
  const [consent,setConsent]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<KnowledgeSearch|null>(null);
  const action=useOperationsAction(docs.reload);const scopeBody={scope,...(scope==='job'?{jobId}:{})};
  return <><OText title>Memoria y conocimiento</OText><OButton label="Actualizar" icon="refresh-outline" onPress={docs.reload}/>
    <OSelect label="Alcance" value={scope} onChange={value=>{setScope(value);setResults(null);}} options={[
      {value:'private',label:'Mi cuenta'},...(usuario?.rol==='empresa'?[{value:'organization',label:'Mi empresa'}]:[]),
      {value:'job',label:'Trabajo propio'},{value:'platform',label:'Documentacion OfiAI'}]}/>
    {scope==='job'&&<OInput label="Trabajo ID" value={jobId} onChange={setJobId} max={128}/>}
    <OInput label="Buscar" value={query} onChange={setQuery} max={500}/>
    <OButton label="Buscar conocimiento" icon="search-outline" disabled={action.busy||query.length<2} onPress={()=>void action.run<KnowledgeSearch>('/knowledge/search',{...scopeBody,query}).then(value=>{if(value)setResults(value);})}/>
    <OState loading={docs.loading} error={docs.error||action.error}/>
    {results?.hits.map(hit=><OItem key={hit.documentId}><OText title>{hit.title}</OText><OText>{hit.excerpt}</OText><OText>Version {hit.version}</OText></OItem>)}
    {results?.hits.length===0&&<OText>No se encontraron fragmentos.</OText>}
    {(scope!=='platform'||usuario?.rol==='admin')&&<>
      <OInput label="Titulo de memoria" value={title} onChange={setTitle} max={140}/>
      <OSelect label="Tipo" value={kind} onChange={setKind} options={['preference','policy','history','procedure','documentation'].map(value=>({value,label:value}))}/>
      <OInput label="Contenido" value={text} onChange={setText} multiline max={8000}/>
      <OText>Autorizo conservar esta informacion durante 90 dias.</OText><Switch accessibilityLabel="Autorizar memoria" value={consent} onValueChange={setConsent}/>
      <OButton label="Guardar memoria" icon="save-outline" disabled={action.busy||!consent||title.length<3||text.length<3}
        onPress={()=>void action.run('/knowledge',{...scopeBody,title,text,kind,consent,retentionDays:90,published:false}).then(value=>{if(value){setTitle('');setText('');setConsent(false);}})}/>
    </>}
    {docs.data?.documents.map(doc=><OItem key={doc.id}><OText title>{doc.title}</OText><OText>{doc.text}</OText>
      <OText>{doc.published?'Publicado':'Borrador'} · Vence {new Date(doc.expiresAt).toLocaleDateString()}</OText>
      {(scope!=='platform'||usuario?.rol==='admin')&&<>
        {!doc.published&&<OButton label="Publicar" disabled={action.busy} onPress={()=>confirmOperation('Publicar para todos los usuarios?',()=>{void action.run('/knowledge/'+doc.id+'/commands',{version:doc.version,action:'publish'});})}/>}
        <OButton label="Eliminar" icon="trash-outline" disabled={action.busy} onPress={()=>confirmOperation('Eliminar definitivamente este contenido?',()=>{void action.run('/knowledge/'+doc.id+'/commands',{version:doc.version,action:'delete'});})}/>
      </>}
    </OItem>)}
  </>;
}
