/** @archivo governance.repository.ts @descripcion Presupuestos diarios, observaciones y auditoria minima. */
import { createHash } from 'node:crypto';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { env } from '../config/env';
import type { ProviderUsage } from '../monitoring/ai-usage';
import { ApiError } from '../middleware/error.middleware';
export interface AiObservation {
  id: string; ownerId: string; agent: string; status: 'completed' | 'fallback' | 'failed';
  startedAt: string; durationMs: number; providerCalls: ProviderUsage[];
  estimatedCostUsd: number | null; costBasis: 'configured_rates' | 'unavailable';
  validationFailures: number; fallbackReason: string | null; promptVersion: string;
  reviewCounts?: Record<'suspected_hallucination'|'confirmed_issue'|'acceptable',number>;
}
/** No conserva preguntas, mensajes ni contenido de documentos en la observabilidad. */
export class GovernanceRepository {
  /** Contador persistente por cuenta/dia, valido tambien con multiples instancias. */
  async reserve(uid: string): Promise<void> {
    const id=createHash('sha256').update(uid).digest('hex')+'_'+new Date().toISOString().slice(0,10);
    const ref=firestore.collection(C.AI_BUDGETS).doc(id);
    await firestore.runTransaction(async tx=>{
      const doc=await tx.get(ref); const count=Number(doc.data()?.calls??0);
      if(count>=env.AI_BUSINESS_DAILY_CALL_LIMIT) throw new ApiError('Se alcanzo el limite diario de IA. Se mantienen disponibles las reglas.',429);
      tx.set(ref,{ownerId: uid,calls: count+1,day: new Date().toISOString().slice(0,10),
        expiresAt: new Date(Date.now()+7*86400000)});
    });
  }
  /** Observacion escrita al finalizar; la tarifa configurada no se presenta como factura. */
  async record(data: Omit<AiObservation,'id'>): Promise<AiObservation> {
    const ref=firestore.collection(C.AI_OBSERVATIONS).doc(); const value={...data,id: ref.id};
    await ref.create(value); return value;
  }
  /** Lectura administrativa acotada y explicitamente reciente. */
  async recent(): Promise<AiObservation[]> {
    const docs=await firestore.collection(C.AI_OBSERVATIONS).orderBy('startedAt','desc').limit(100).get();
    return docs.docs.map(doc=>doc.data() as AiObservation);
  }
  /** Revision humana de una salida, no detector magico de alucinaciones. */
  async feedback(id: string,actorId: string,verdict: 'suspected_hallucination' | 'confirmed_issue' | 'acceptable'): Promise<void> {
    const ref=firestore.collection(C.AI_OBSERVATIONS).doc(id);
    await firestore.runTransaction(async tx=>{
      const review=ref.collection('reviews').doc(actorId);
      const [observation,previous]=await tx.getAll(ref,review);
      if(!observation.exists) throw new ApiError('Observacion no encontrada.',404);
      const counts={suspected_hallucination:0,confirmed_issue:0,acceptable:0,...observation.data()?.reviewCounts} as NonNullable<AiObservation['reviewCounts']>;
      const before=previous.data()?.verdict as keyof typeof counts|undefined;
      if(before&&before in counts)counts[before]=Math.max(0,counts[before]-1);
      counts[verdict]++;
      tx.set(review,{verdict,actorId,at: new Date().toISOString()});
      tx.update(ref,{reviewCounts:counts});
    });
  }
}
export const governanceRepository=new GovernanceRepository();
