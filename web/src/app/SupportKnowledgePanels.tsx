/** @archivo SupportKnowledgePanels.tsx @descripcion Soporte persistente y memoria controlada por el titular. */
import { useRef,useState } from 'react';
import { Send,Plus,Trash2,Search,Check,Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import { AgentState,AgentRefresh,useAgentAction } from './AgentWorkspace';
import { WhatsAppContact } from '../layouts/WhatsAppContact';
import type { SupportSession,SupportTicket } from '../../../shared/support';
import type { KnowledgeDocument,KnowledgeSearch } from '../../../shared/knowledge';
/** Conversacion real, recuperable y con un identificador estable por reintento. */
export function SupportPanel() {
  const {role}=useAuth();const [id,setId]=useState('');const [tool,setTool]=useState('');const [resourceId,setResourceId]=useState('');
  const sessions=useApiResource<SupportSession[]>('/support/sessions');
  const current=useApiResource<SupportSession>(id?'/support/sessions/'+id:null);
  const tickets=useApiResource<SupportTicket[]>(role==='admin'?'/support/tickets':null);
  const [ticketId,setTicketId]=useState('');
  const ticket=useApiResource<{ticket:SupportTicket;session:SupportSession}>(ticketId?'/support/tickets/'+ticketId:null);
  const [message,setMessage]=useState('');const [humanMessage,setHumanMessage]=useState('');
  const pending=useRef<{id:string;text:string}|null>(null);
  const action=useAgentAction(()=>{sessions.reload();current.reload();tickets.reload();ticket.reload();});
  /** Crea contexto opcional; el servidor verifica propiedad del recurso. */
  async function start() {
    const value=await action.run<SupportSession>('/support/sessions',{resource:tool?{tool,...(tool!=='getSubscription'?{id:resourceId}:{})}:null});
    if(value){setId(value.id);setMessage('');}
  }
  /** Conserva la clave despues de un fallo de red para no duplicar la interaccion. */
  async function send() {
    if(!current.data||!message.trim())return;
    if(pending.current?.text!==message)pending.current={id:crypto.randomUUID(),text:message};
    const value=await action.run<SupportSession>('/support/sessions/'+id+'/messages',{message,version:current.data.version,requestId:pending.current.id});
    if(value){setMessage('');pending.current=null;}
  }
  return <><div className="agent-row"><h2>Soporte</h2><AgentRefresh onClick={()=>{sessions.reload();current.reload();tickets.reload();}}/><WhatsAppContact /></div>
    <div className="agent-form"><label>Contexto<select value={tool} onChange={e=>setTool(e.target.value)}>
      <option value="">Consulta general</option><option value="getJob">Un trabajo</option><option value="getSubscription">Mi suscripcion</option>
      <option value="getInvoice">Un recibo</option><option value="getProfessional">Un profesional</option></select></label>
      {tool&&tool!=='getSubscription'&&<label>Identificador<input maxLength={128} value={resourceId} onChange={e=>setResourceId(e.target.value)}/></label>}
      <button className="ofi-btn-secondary" disabled={action.busy} onClick={()=>void start()}><Plus size={17}/>Nueva conversacion</button>
    </div>
    <AgentState loading={sessions.loading||current.loading} error={sessions.error||current.error||action.notice}/>
    <label>Conversaciones<select value={id} onChange={e=>{setId(e.target.value);setMessage('');pending.current=null;}}><option value="">Seleccionar conversacion</option>
      {sessions.data?.map(session=><option value={session.id} key={session.id}>{new Date(session.createdAt).toLocaleString()} · {session.status}</option>)}</select></label>
    {sessions.data?.length===0&&<p>No hay conversaciones guardadas.</p>}
    {current.data&&<>
      <div className="agent-conversation" role="log" aria-live="polite">{current.data.messages.map(item=><article className={'agent-message '+item.author} key={item.id}>
        <strong>{item.author==='user'?'Vos':item.author==='human'?'Equipo OfiAI':'Soporte OfiAI'}</strong><p>{item.text}</p>
        {!!item.sources.length&&<small>Fuentes: {item.sources.join(', ')}</small>}</article>)}</div>
      <form className="agent-form" onSubmit={e=>{e.preventDefault();void send();}}>
        <label>Mensaje<textarea value={message} maxLength={4000} required onChange={e=>setMessage(e.target.value)} disabled={current.data.status==='resolved'}/></label>
        <button className="ofi-btn-primary" disabled={action.busy||current.data.status==='resolved'}><Send size={17}/>{action.busy?'Procesando...':'Enviar'}</button>
      </form></>}
    {role==='admin'&&<section className="agent-section"><h3>Atencion humana</h3><AgentState loading={tickets.loading||ticket.loading} error={tickets.error||ticket.error}/>
      <div className="agent-list">{tickets.data?.map(item=><article className="agent-item" key={item.id}><h3>{item.category} · {item.priority}</h3><p>{item.status} · {new Date(item.createdAt).toLocaleString()}</p>
        <button className="ofi-btn-secondary" onClick={()=>setTicketId(item.id)}>Abrir caso</button></article>)}</div>
      {ticket.data&&<><div className="agent-conversation">{ticket.data.session.messages.map(item=><p className={'agent-message '+item.author} key={item.id}>{item.text}</p>)}</div>
        <label>Respuesta humana<textarea value={humanMessage} maxLength={4000} onChange={e=>setHumanMessage(e.target.value)}/></label>
        <div className="agent-row">{[['claim','Tomar caso'],['reply','Responder'],['resolve','Resolver']].map(([value,label])=><button key={value} className="ofi-btn-secondary"
          disabled={action.busy||ticket.data!.ticket.status==='resolved'||(value==='reply'&&!humanMessage.trim())}
          onClick={()=>{if(value==='resolve'&&!window.confirm('Marcar este caso como resuelto?'))return;
            void action.run('/support/tickets/'+ticketId+'/commands',{version:ticket.data!.ticket.version,action:value,...(value==='reply'?{message:humanMessage}:{})});}}>{label}</button>)}</div></>}
    </section>}
  </>;
}
/** El usuario elige que recordar y puede eliminarlo sin conservar el texto en auditoria. */
export function KnowledgePanel() {
  const {role}=useAuth();const [scope,setScope]=useState('private');const [jobId,setJobId]=useState('');
  const [title,setTitle]=useState('');const [text,setText]=useState('');const [kind,setKind]=useState('preference');const [consent,setConsent]=useState(false);
  const [query,setQuery]=useState('');const [results,setResults]=useState<KnowledgeSearch|null>(null);
  const docs=useApiResource<{documents:KnowledgeDocument[];partial:boolean}>(scope==='job'&&!jobId?null:'/knowledge?scope='+scope+(jobId?'&jobId='+encodeURIComponent(jobId):''));
  const action=useAgentAction(docs.reload);
  const scopeBody={scope,...(scope==='job'?{jobId}:{})};
  return <><div className="agent-row"><h2>Memoria y conocimiento</h2><AgentRefresh onClick={docs.reload}/></div>
    <div className="agent-form"><label>Alcance<select value={scope} onChange={e=>{setScope(e.target.value);setResults(null);}}>
      <option value="private">Mi cuenta</option>{role==='empresa'&&<option value="organization">Mi empresa</option>}<option value="job">Un trabajo propio</option><option value="platform">Documentacion OfiAI</option></select></label>
      {scope==='job'&&<label>Trabajo ID<input value={jobId} maxLength={128} onChange={e=>setJobId(e.target.value)}/></label>}
    </div>
    <form className="agent-form" onSubmit={e=>{e.preventDefault();void action.run<KnowledgeSearch>('/knowledge/search',{...scopeBody,query}).then(value=>{if(value)setResults(value);});}}>
      <label>Buscar conocimiento<input value={query} minLength={2} maxLength={500} required onChange={e=>setQuery(e.target.value)}/></label>
      <button className="ofi-btn-secondary" disabled={action.busy}><Search size={17}/>Buscar</button>
    </form>
    <AgentState loading={docs.loading} error={docs.error||action.notice}/>
    {results&&<div className="agent-list">{results.hits.length===0&&<p>No se encontraron fragmentos relacionados.</p>}{results.hits.map(hit=><article className="agent-item" key={hit.documentId}><h3>{hit.title}</h3><p>{hit.excerpt}</p><small>{hit.documentId} · Version {hit.version}</small></article>)}</div>}
    {(scope!=='platform'||role==='admin')&&<form className="agent-form" onSubmit={e=>{e.preventDefault();
      void action.run('/knowledge',{...scopeBody,title,text,kind,consent,retentionDays:90,published:false}).then(value=>{if(value){setTitle('');setText('');setConsent(false);}});}}>
      <h3>Nueva memoria</h3><label>Titulo<input value={title} minLength={3} maxLength={140} required onChange={e=>setTitle(e.target.value)}/></label>
      <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}>{['preference','policy','history','procedure','documentation'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Contenido<textarea value={text} minLength={3} maxLength={8000} required onChange={e=>setText(e.target.value)}/></label>
      <label className="agent-check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo guardar este contenido durante 90 dias.</label>
      <button className="ofi-btn-primary" disabled={action.busy||!consent}><Save size={17}/>Guardar</button>
    </form>}
    <div className="agent-list">{docs.data?.documents.map(doc=><article className="agent-item" key={doc.id}><h3>{doc.title}</h3><p>{doc.text}</p>
      <small>Version {doc.version} · {doc.published?'Publicado':'Borrador'} · Vence {new Date(doc.expiresAt).toLocaleDateString()}</small>
      {(scope!=='platform'||role==='admin')&&<div className="agent-row">
        {!doc.published&&<button disabled={action.busy} className="ofi-btn-secondary" onClick={()=>{if(window.confirm('Publicar esta documentacion para todos los usuarios?'))void action.run('/knowledge/'+doc.id+'/commands',{version:doc.version,action:'publish'});}}><Check size={17}/>Publicar</button>}
        <button disabled={action.busy} className="ofi-btn-secondary" title="Eliminar memoria" aria-label={'Eliminar '+doc.title}
          onClick={()=>{if(window.confirm('Eliminar definitivamente este contenido?'))void action.run('/knowledge/'+doc.id+'/commands',{version:doc.version,action:'delete'});}}><Trash2 size={17}/></button>
      </div>}</article>)}</div>
    {docs.data?.documents.length===0&&<p>No hay contenido vigente en este alcance.</p>}
  </>;
}
