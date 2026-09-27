/** @archivo knowledge.repository.ts @descripcion Memoria versionada; borrado real del contenido y auditoria minima. */
import { createHash } from 'node:crypto';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import type { KnowledgeDocument } from '../../../shared/knowledge';
import { ApiError } from '../middleware/error.middleware';
/** Toda consulta exige una scopeKey ya autorizada por el servicio. */
export class KnowledgeRepository {
  /** Elimina un lote de memorias vencidas; no conserva texto en el registro de auditoria. */
  async purgeExpired():Promise<number> {
    const docs=await firestore.collection(C.AI_KNOWLEDGE).where('expiresAt','<=',new Date().toISOString()).limit(100).get();
    let deleted=0;
    for(const doc of docs.docs) {
      await firestore.runTransaction(async tx=>{
        const current=await tx.get(doc.ref);const value=current.data() as KnowledgeDocument|undefined;
        if(!value||Date.parse(value.expiresAt)>Date.now())return;
        tx.delete(doc.ref);
        tx.create(firestore.collection(C.AGENT_AUDIT).doc(),{action:'knowledge.expired',resourceId:doc.id,at:new Date().toISOString(),version:value.version});
      });deleted++;
    }
    return deleted;
  }
  /** Persiste solamente memoria solicitada de forma explicita por el titular. */
  async create(data: Omit<KnowledgeDocument,'id'>): Promise<KnowledgeDocument> {
    const ref = firestore.collection(C.AI_KNOWLEDGE).doc(); const document = {...data,id: ref.id};
    const batch = firestore.batch(); batch.create(ref,document);
    batch.create(firestore.collection(C.AGENT_AUDIT).doc(),{action: 'knowledge.created',resourceId: ref.id,
      actorId: data.ownerId,scope: data.scope,version: 1,at: data.createdAt,contentHash: createHash('sha256').update(data.text).digest('hex')});
    await batch.commit(); return document;
  }
  /** Acota busqueda y filtra documentos vencidos antes de devolverlos. */
  async list(scopeKey: string,includeDrafts = false): Promise<{documents: KnowledgeDocument[];partial: boolean}> {
    const docs = await firestore.collection(C.AI_KNOWLEDGE).where('scopeKey','==',scopeKey).orderBy('updatedAt','desc').limit(101).get();
    return { documents: docs.docs.slice(0,100).map(doc=>doc.data() as KnowledgeDocument)
      .filter(doc=>Date.parse(doc.expiresAt)>Date.now() && (includeDrafts || doc.published)),
      partial: docs.size>100 };
  }
  /** Acceso puntual que el servicio vuelve a validar por alcance. */
  async get(id: string): Promise<KnowledgeDocument> {
    const doc = await firestore.collection(C.AI_KNOWLEDGE).doc(id).get();
    if (!doc.exists) throw new ApiError('Documento no encontrado.',404);
    return doc.data() as KnowledgeDocument;
  }
  /** Aprueba una version concreta o elimina contenido; no borra auditoria. */
  async change(id: string,ownerId: string,version: number,action: 'publish' | 'delete'): Promise<void> {
    const ref = firestore.collection(C.AI_KNOWLEDGE).doc(id);
    await firestore.runTransaction(async tx=>{
      const doc = await tx.get(ref); const data = doc.data() as KnowledgeDocument | undefined;
      if (!data || data.version!==version) throw new ApiError('El documento cambio o no existe.',409);
      if (action==='delete') tx.delete(ref);
      else tx.update(ref,{published: true,version: version+1,updatedAt: new Date().toISOString()});
      tx.create(firestore.collection(C.AGENT_AUDIT).doc(),{action: 'knowledge.'+action,resourceId: id,actorId: ownerId,version,at: new Date().toISOString()});
    });
  }
}
export const knowledgeRepository = new KnowledgeRepository();
