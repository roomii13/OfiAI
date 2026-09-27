/** @archivo agent-event.repository.ts @descripcion Cola local Firestore con lease, backoff y limite de intentos. */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import type { AgentBusinessEvent } from '../events/agent.event';
/** Procesa eventos persistidos con el trabajo, no tareas desconectadas del proceso. */
export class AgentEventRepository {
  /** Recupera eventos pendientes o leases vencidos. */
  async due():Promise<AgentBusinessEvent[]> {
    const docs=await firestore.collection(C.AGENT_EVENTS).where('state','in',['pending','processing'])
      .where('availableAt','<=',new Date().toISOString()).orderBy('availableAt').limit(5).get();
    return docs.docs.map(doc=>doc.data() as AgentBusinessEvent);
  }
  /** Reclama el evento; cada reintento utiliza la misma clave del Orchestrator. */
  async claim(id:string):Promise<AgentBusinessEvent|null> {
    const ref=firestore.collection(C.AGENT_EVENTS).doc(id);
    return firestore.runTransaction(async tx=>{
      const doc=await tx.get(ref);const value=doc.data() as AgentBusinessEvent;
      if(!value||!['pending','processing'].includes(value.state)||Date.parse(value.availableAt)>Date.now())return null;
      if(value.attempts>=3){tx.update(ref,{state:'failed',updatedAt:new Date().toISOString()});return null;}
      const next={...value,state:'processing' as const,attempts:value.attempts+1,
        availableAt:new Date(Date.now()+240000).toISOString(),updatedAt:new Date().toISOString()};
      tx.set(ref,next);return next;
    });
  }
  /** Una finalizacion vieja no sobrescribe el lease de otro worker. */
  async finish(event:AgentBusinessEvent,success:boolean):Promise<void> {
    const ref=firestore.collection(C.AGENT_EVENTS).doc(event.id);
    await firestore.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data() as AgentBusinessEvent;
      if(current.attempts!==event.attempts||current.state!=='processing')return;
      tx.update(ref,{state:success?'completed':event.attempts>=3?'failed':'pending',
        availableAt:new Date(Date.now()+Math.pow(2,event.attempts)*60000).toISOString(),updatedAt:new Date().toISOString()});
    });
  }
}
export const agentEventRepository=new AgentEventRepository();
