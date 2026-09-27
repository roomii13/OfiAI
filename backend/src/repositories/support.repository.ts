/** @archivo support.repository.ts @descripcion Sesiones privadas con idempotencia, contexto acotado y tickets. */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { SupportSession, SupportTicket, SupportMessage } from '../../../shared/support';
/** Persiste conversaciones sin conceder acceso directo al modelo. */
export class SupportRepository {
  /** Crea una sesion vacia valida, con historial limitado por el servicio. */
  async create(ownerId: string, resource: SupportSession['resource']): Promise<SupportSession> {
    const ref = firestore.collection(C.SUPPORT_SESSIONS).doc(); const now = new Date().toISOString();
    const value: SupportSession = { id: ref.id, ownerId, resource, status: 'open', messages: [], version: 1, createdAt: now, updatedAt: now };
    await ref.create(value); return value;
  }
  /** Revalida ownership sin filtrar datos a quien conoce un ID ajeno. */
  async get(id: string, ownerId: string): Promise<SupportSession> {
    const doc = await firestore.collection(C.SUPPORT_SESSIONS).doc(id).get();
    const value = doc.data() as SupportSession | undefined;
    if (!value || value.ownerId !== ownerId) throw new ApiError('Conversacion no encontrada.',404);
    return value;
  }
  /** Lista solo sesiones del titular; no incluye conversaciones de otras cuentas. */
  async list(ownerId: string): Promise<SupportSession[]> {
    const docs = await firestore.collection(C.SUPPORT_SESSIONS).where('ownerId','==',ownerId).orderBy('updatedAt','desc').limit(20).get();
    return docs.docs.map(doc => doc.data() as SupportSession);
  }
  /** Escribe usuario y respuesta juntos; un reintento no agrega dos mensajes ni dos tickets. */
  async append(session: SupportSession, requestId: string, messages: SupportMessage[], escalation: { category: SupportTicket['category']; priority: SupportTicket['priority'] } | null) {
    const ref = firestore.collection(C.SUPPORT_SESSIONS).doc(session.id); const receipt = ref.collection('requests').doc(requestId);
    return firestore.runTransaction(async tx => {
      const [snapshot, done, ticketDoc] = await tx.getAll(ref,receipt,firestore.collection(C.SUPPORT_TICKETS).doc(session.id));
      const current = snapshot.data() as SupportSession;
      if (!current || current.ownerId !== session.ownerId) throw new ApiError('Conversacion no encontrada.',404);
      if (done.exists) return current;
      if (current.version !== session.version || current.status === 'resolved') throw new ApiError('La conversacion cambio o esta resuelta.',409);
      if (current.messages.length + messages.length > 100) throw new ApiError('Inicia una nueva conversacion para continuar.',409);
      const now = new Date().toISOString();
      const updated = { ...current, messages: [...current.messages,...messages], version: current.version + 1,
        updatedAt: now, status: escalation ? 'escalated' as const : current.status };
      tx.set(ref,updated); tx.create(receipt,{ at: now });
      if (escalation && !ticketDoc.exists) tx.create(ticketDoc.ref, { id: session.id, sessionId: session.id, ownerId: current.ownerId,
        ...escalation, status: 'open', assignedTo: null, version: 1, createdAt: now, updatedAt: now } satisfies SupportTicket);
      return updated;
    });
  }
  /** Bandeja humana de tickets recientes. */
  async tickets(): Promise<SupportTicket[]> {
    const docs = await firestore.collection(C.SUPPORT_TICKETS).orderBy('updatedAt','desc').limit(50).get();
    return docs.docs.map(doc => doc.data() as SupportTicket);
  }
  /** Acceso humano explicito a un ticket; el rol se verifica antes en servicio. */
  async ticket(id: string) {
    const doc = await firestore.collection(C.SUPPORT_TICKETS).doc(id).get();
    if (!doc.exists) throw new ApiError('Ticket no encontrado.',404);
    const ticket = doc.data() as SupportTicket;
    return { ticket, session: await this.get(ticket.sessionId,ticket.ownerId) };
  }
  /** Responde, toma o resuelve; los cambios quedan firmados por el administrador. */
  async resolve(id: string, uid: string, version: number, action: 'claim' | 'reply' | 'resolve', message?: string) {
    const ref = firestore.collection(C.SUPPORT_TICKETS).doc(id);
    await firestore.runTransaction(async tx => {
      const ticketDoc = await tx.get(ref); const ticket = ticketDoc.data() as SupportTicket | undefined;
      if (!ticket) throw new ApiError('Ticket no encontrado.',404);
      const sessionRef = firestore.collection(C.SUPPORT_SESSIONS).doc(ticket.sessionId);
      const snapshot = await tx.get(sessionRef); const session = snapshot.data() as SupportSession;
      if (ticket.version !== version || ticket.status === 'resolved') throw new ApiError('El ticket cambio o esta resuelto.',409);
      if (ticket.assignedTo && ticket.assignedTo !== uid) throw new ApiError('El ticket esta asignado a otra persona.',409);
      if (action === 'reply' && (!message || session.messages.length >= 100)) throw new ApiError('Respuesta no valida o conversacion completa.',400);
      const now = new Date().toISOString();
      tx.update(ref,{ status: action === 'resolve' ? 'resolved' : 'in_progress', assignedTo: uid, version: version + 1, updatedAt: now });
      tx.update(sessionRef,{ status: action === 'resolve' ? 'resolved' : 'escalated', version: session.version + 1, updatedAt: now,
        messages: action === 'reply' ? [...session.messages,{ id: 'human_' + version, author: 'human', text: message, at: now, sources: [] }] : session.messages });
      tx.create(ref.collection('audit').doc(), { action, actorId: uid, at: now });
    });
    return this.ticket(id);
  }
}
export const supportRepository = new SupportRepository();
