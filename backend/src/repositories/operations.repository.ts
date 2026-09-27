/** @archivo operations.repository.ts @descripcion Proyecciones operativas y moderacion auditada en transaccion. */
import { FieldPath } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { OperationsResource,OperationsList } from '../../../shared/operations';
const resources:Record<Exclude<OperationsResource,'matches'>,{collection:string;fields:string[]}> = {
  users:{collection:C.USUARIOS,fields:['nombre','apellido','email','rol','activo']},
  companies:{collection:C.EMPRESAS,fields:['nombreEmpresa','industria','ciudad','activo']},
  professionals:{collection:C.PROFESIONALES,fields:['nombre','apellido','ciudad','verificado','status','disponible']},
  jobs:{collection:C.TRABAJOS,fields:['titulo','categoria','ciudad','estado','coordinationState','moderationStatus']},
  subscriptions:{collection:C.SUSCRIPCIONES,fields:['plan','estado','moneda','precioMensual','renovacionAutomatica']},
  transactions:{collection:C.BILLING_PAYMENTS,fields:['currency','amountMinor','refundedMinor','status','paidAt']},
};
/** Mantiene al panel interno fuera del acceso indiscriminado a Firestore. */
export class OperationsRepository {
  /** Pagina solo campos publicables a operadores; Matches requiere un Job especifico. */
  async list(resource:OperationsResource,cursor?:string,jobId?:string):Promise<OperationsList> {
    const config=resource==='matches'?{collection:C.MATCHES,fields:['professionalId','matchScore','deterministicScore','semanticScore','state','reason']}:resources[resource];
    const root=resource==='matches'?firestore.collection(C.TRABAJOS).doc(jobId!).collection(C.MATCHES):firestore.collection(config.collection);
    let query=root.orderBy(FieldPath.documentId()).select(...config.fields).limit(51);if(cursor)query=query.startAfter(cursor);
    const docs=await query.get();const page=docs.docs.slice(0,50);
    return {resource,nextCursor:docs.size>50?page.at(-1)!.id:null,rows:page.map(doc=>({id:doc.id,
      fields:Object.fromEntries(config.fields.map(key=>{const value:unknown=doc.data()[key];return[key,
        typeof value==='string'||typeof value==='boolean'||typeof value==='number'?value:null];}))}))};
  }
  /** Moderacion no cobra, devuelve dinero, borra usuarios ni acepta trabajos. */
  async moderate(actorId:string,targetId:string,action:'suspend_user'|'restore_user'|'verify_professional'|'unverify_professional'|'flag_job'|'clear_job',reason:string) {
    const kind=action.endsWith('_user')?'user':action.endsWith('_professional')?'professional':'job';
    const ref=firestore.collection(kind==='user'?C.USUARIOS:kind==='professional'?C.PROFESIONALES:C.TRABAJOS).doc(targetId);
    await firestore.runTransaction(async tx=>{
      const doc=await tx.get(ref);const data=doc.data();if(!data)throw new ApiError('Registro no encontrado.',404);
      if(kind==='user'&&(actorId===targetId||data.rol==='admin'))throw new ApiError('No se modifican cuentas administrativas desde esta accion.',409);
      const profiles=kind==='user'?(await tx.get(firestore.collection(C.PROFESIONALES).where('usuarioId','==',targetId).limit(5))).docs:[];
      if(kind==='professional') {
        const owner=await tx.get(firestore.collection(C.USUARIOS).doc(String(data.usuarioId)));
        if(action==='verify_professional'&&!owner.data()?.activo)throw new ApiError('No se verifica un perfil de cuenta suspendida.',409);
      }
      const now=new Date();
      if(kind==='user') {
        const active=action==='restore_user';tx.update(ref,{activo:active,fechaActualizacion:now});
        profiles.forEach(profile=>tx.update(profile.ref,{activo:active,status:active?'active':'suspended',disponible:false,fechaActualizacion:now}));
      } else if(kind==='professional')tx.update(ref,{verificado:action==='verify_professional',fechaActualizacion:now});
      else tx.update(ref,{moderationStatus:action==='flag_job'?'flagged':'clear',fechaActualizacion:now});
      tx.create(firestore.collection(C.AGENT_AUDIT).doc(),{action,actorId,resourceId:targetId,reason,at:now.toISOString()});
    });
    return {id:targetId,action};
  }
  /** Agregados exactos, separados de distribuciones muestreadas. */
  async counts() {
    const leads=await firestore.collection(C.SALES_LEADS).count().get();
    const customers=await firestore.collection(C.SALES_LEADS).where('stage','==','CUSTOMER').count().get();
    const tickets=await firestore.collection(C.SUPPORT_TICKETS).where('status','in',['open','in_progress']).count().get();
    const flagged=await firestore.collection(C.TRABAJOS).where('moderationStatus','==','flagged').count().get();
    return {leads:leads.data().count,customers:customers.data().count,openTickets:tickets.data().count,flaggedJobs:flagged.data().count};
  }
}
export const operationsRepository=new OperationsRepository();
