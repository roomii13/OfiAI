/** @archivo orchestrator.repository.ts @descripcion Leases y auditoria durable de ejecuciones idempotentes. */
import { createHash } from 'node:crypto';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { AgentRun, BusinessEvent } from '../../../shared/orchestrator';
/** Persiste estados sin almacenar prompts ni secretos. */
export class OrchestratorRepository {
  /** La misma clave pertenece a una cuenta y a una unica entrada canonica. */
  async claim(ownerId: string,event: BusinessEvent,resourceId: string | null,key: string) {
    const id = createHash('sha256').update(ownerId+':'+key).digest('hex');
    const ref = firestore.collection(C.AGENT_RUNS).doc(id); const now = new Date().toISOString();
    return firestore.runTransaction(async tx => {
      const doc = await tx.get(ref); const current = doc.data() as AgentRun | undefined;
      if (current && (current.event !== event || current.resourceId !== resourceId)) throw new ApiError('La clave ya pertenece a otra operacion.',409);
      if (current && (current.status !== 'failed' && current.status !== 'processing' || current.leaseUntil > Date.now()))
        return {run: current, acquired: false};
      if (current && current.version >= 3) return {run: current,acquired: false};
      const run: AgentRun = { id,ownerId,event,resourceId,status: 'processing',steps: [],message: 'Analizando la siguiente accion.',
        createdAt: current?.createdAt ?? now,updatedAt: now,leaseUntil: Date.now()+180000,
        durationMs: 0,version: (current?.version ?? 0)+1,result: null };
      tx.set(ref,run); return {run,acquired: true};
    });
  }
  /** Una corrida antigua no pisa el resultado de otro intento. */
  async finish(run: AgentRun): Promise<AgentRun> {
    const ref = firestore.collection(C.AGENT_RUNS).doc(run.id);
    await firestore.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() as AgentRun;
      if (current.version !== run.version) throw new ApiError('La ejecucion fue retomada por otro proceso.',409);
      tx.set(ref,{...run,leaseUntil: 0});
    });
    return {...run,leaseUntil: 0};
  }
  /** Lectura por titular o administracion; nunca se permite cambiar el ownerId. */
  async get(id: string,ownerId: string,admin: boolean): Promise<AgentRun> {
    const doc = await firestore.collection(C.AGENT_RUNS).doc(id).get(); const run = doc.data() as AgentRun | undefined;
    if (!run || (!admin && run.ownerId !== ownerId)) throw new ApiError('Ejecucion no encontrada.',404);
    return run;
  }
  /** Ultimas cincuenta ejecuciones del alcance autorizado. */
  async list(ownerId: string,admin: boolean): Promise<AgentRun[]> {
    const root = firestore.collection(C.AGENT_RUNS);
    const query = admin ? root : root.where('ownerId','==',ownerId);
    const docs = await query.orderBy('createdAt','desc').limit(50).get();
    return docs.docs.map(doc=>doc.data() as AgentRun);
  }
}
export const orchestratorRepository = new OrchestratorRepository();
