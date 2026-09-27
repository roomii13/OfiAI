/** @archivo AgentWorkspace.tsx @descripcion Espacio operativo de agentes con navegacion por permisos. */
import { useRef,useState,type ReactNode } from 'react';
import { NavLink,useParams } from 'react-router-dom';
import { BookOpen,BarChart3,Headphones,Workflow,Users,Megaphone,ShieldCheck,RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api/client';
import { SalesPanel,MarketingPanel } from './GrowthPanels';
import { SupportPanel,KnowledgePanel } from './SupportKnowledgePanels';
import { IntelligencePanel,AgentRunsPanel,GovernancePanel } from './IntelligencePanels';
import { OperationsPanel,CommandCenterPanel } from './OperationsPanels';
import './agents.css';
/** Estado de mutaciones con exclusividad inmediata y errores sin trazas. */
export function useAgentAction(reload?: ()=>void) {
  const lock=useRef(false); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  /** Ejecuta una accion explicita y devuelve solo datos del servidor. */
  async function run<T>(path: string,body: unknown,method: 'post'|'put'='post'): Promise<T | null> {
    if(lock.current) return null; lock.current=true; setBusy(true); setNotice('');
    try { const response=await api[method]<{datos:T}>(path,body); reload?.(); return response.datos; }
    catch(error) { setNotice(error instanceof Error?error.message:'No se pudo completar la accion.'); return null; }
    finally {lock.current=false;setBusy(false);}
  }
  return {busy,notice,setNotice,run};
}
/** Estados de lectura reutilizados por vistas operativas. */
export function AgentState({loading,error,children}: {loading?:boolean;error?:string;children?:ReactNode}) {
  return <>{loading&&<p role="status">Cargando...</p>}{error&&<p role="alert" className="agent-error">{error}</p>}{children}</>;
}
/** Boton de recarga con simbolo familiar y etiqueta accesible. */
export function AgentRefresh({onClick}: {onClick:()=>void}) {
  return <button className="ofi-btn-secondary" type="button" aria-label="Actualizar" title="Actualizar" onClick={onClick}><RefreshCw size={18}/></button>;
}
/** Cada tab conserva las mismas restricciones que su endpoint. */
export function AgentWorkspace() {
  const {section='support'}=useParams(); const {role}=useAuth();
  const tabs=[{id:'support',label:'Soporte',icon:Headphones},{id:'intelligence',label:'Inteligencia',icon:BarChart3},
    {id:'knowledge',label:'Conocimiento',icon:BookOpen},{id:'runs',label:'Ejecuciones',icon:Workflow},
    {id:'sales',label:role==='admin'?'CRM':'Preferencias comerciales',icon:Users},
    ...(role==='admin'?[{id:'marketing',label:'Marketing',icon:Megaphone},{id:'governance',label:'Gobierno IA',icon:ShieldCheck},
      {id:'admin',label:'Administracion',icon:Users},{id:'center',label:'Command Center',icon:BarChart3}]:[])];
  const active=tabs.find(tab=>tab.id===section)?.id??'support';
  return <DashboardLayout><main className="agent-workspace">
    <header className="agent-heading"><div><p className="agent-eyebrow">OfiAI</p><h1>Centro de operaciones</h1></div></header>
    <nav className="agent-tabs" aria-label="Areas operativas">{tabs.map(tab=><NavLink key={tab.id} to={'/operations/'+tab.id}><tab.icon size={17}/>{tab.label}</NavLink>)}</nav>
    <section key={active} className="agent-section">
      {active==='admin'?<OperationsPanel/>:active==='center'?<CommandCenterPanel/>:active==='sales'?<SalesPanel/>:active==='marketing'?<MarketingPanel/>:active==='knowledge'?<KnowledgePanel/>
        :active==='intelligence'?<IntelligencePanel/>:active==='runs'?<AgentRunsPanel/>:active==='governance'?<GovernancePanel/>:<SupportPanel/>}
    </section>
  </main></DashboardLayout>;
}
