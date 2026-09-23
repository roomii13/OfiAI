/**
 * @archivo intake.repository.ts
 * @descripcion Persistencia transaccional, aislamiento, leases e idempotencia de Intake.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { IntakeResult, IntakeSession } from '../models/intake.model';
import type { IntakeSessionSummary } from '../../../shared/intake';
import type { Trabajo } from '../models/Job';
import { intakeEvent, type IntakeEventType } from '../events/intake.event';

interface StoredSession extends IntakeSession {
  pending: { requestId: string; expiresAt: number } | null;
  expireAt: unknown;
  confirmedAt?: unknown;
  confirmedVersion?: number;
}

/** Oculta campos operativos del documento al cliente. */
function publicSession(stored: StoredSession): IntakeSession {
  const { pending: _pending, expireAt: _expireAt, confirmedAt: _confirmedAt, confirmedVersion: _confirmedVersion, ...session } = stored;
  return session;
}

/** Usa 404 tanto para ids inexistentes como para sesiones ajenas. */
export function requireOwnedSession(session: StoredSession | undefined, userId: string, companyId: string): StoredSession {
  if (!session || session.userId !== userId || session.companyId !== companyId) {
    throw new ApiError('No se encontro la conversacion.', 404);
  }
  return session;
}

/** Repositorio unico de conversaciones; el proveedor nunca se llama en una transaccion. */
export class IntakeRepository {
  /** Inyecta Firestore para poder verificar el contrato transaccional. */
  constructor(private readonly db: Firestore = firestore) {}

  /** Devuelve una referencia dentro de la coleccion autorizada. */
  private ref(id: string) { return this.db.collection(COLECCIONES.AI_INTAKE_SESSIONS).doc(id); }

  /** Agrega un evento a la misma transaccion que el cambio de estado. */
  private event(tx: Transaction, type: IntakeEventType, session: IntakeSession): void {
    const ref = this.db.collection(COLECCIONES.ANALYTICS_EVENTOS).doc();
    tx.create(ref, { id: ref.id, ...intakeEvent(type, session) });
  }

  /** Crea una sesion una sola vez aunque se reintente la solicitud. */
  async create(session: IntakeSession): Promise<IntakeSession> {
    return this.db.runTransaction(async tx => {
      const ref = this.ref(session.id);
      const existing = await tx.get(ref);
      if (existing.exists) return publicSession(requireOwnedSession(existing.data() as StoredSession, session.userId, session.companyId));
      tx.create(ref, { ...session, pending: null, expireAt: new Date(Date.now() + 90 * 86400000) });
      this.event(tx, 'intake_started', session);
      return session;
    });
  }

  /** Consulta una sesion propia sin exponer el lease ni la retencion interna. */
  async get(id: string, userId: string, companyId: string): Promise<IntakeSession> {
    const doc = await this.ref(id).get();
    return publicSession(requireOwnedSession(doc.data() as StoredSession | undefined, userId, companyId));
  }

  /** Lista hasta cien conversaciones propias; ordena sin exigir un indice compuesto nuevo. */
  async list(userId: string, companyId: string): Promise<IntakeSessionSummary[]> {
    const snapshot = await this.db.collection(COLECCIONES.AI_INTAKE_SESSIONS).where('userId', '==', userId).limit(100).get();
    return snapshot.docs.map(doc => doc.data() as StoredSession).filter(s => s.companyId === companyId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(s => ({
        id: s.id, title: s.extractedData.title ?? 'Nueva solicitud', status: s.status, updatedAt: s.updatedAt,
      }));
  }

  /** Reserva un turno y evita mensajes simultaneos o reenvios duplicados. */
  async claim(id: string, userId: string, companyId: string, requestId: string, version: number, message: string): Promise<{ session: IntakeSession; replay: boolean }> {
    return this.db.runTransaction(async tx => {
      const ref = this.ref(id);
      const doc = await tx.get(ref);
      const session = requireOwnedSession(doc.data() as StoredSession | undefined, userId, companyId);
      const previous = session.messages.find(item => item.id === requestId + '-user');
      if (previous) {
        if (previous.content !== message) throw new ApiError('Este mensaje ya fue enviado con otro contenido.', 409);
        return { session: publicSession(session), replay: true };
      }
      this.assertMutable(session, version);
      if (session.messages.length >= 61) throw new ApiError('Esta conversacion alcanzo su limite. Inicia una nueva solicitud.', 409);
      tx.update(ref, { pending: { requestId, expiresAt: Date.now() + 90000 } });
      return { session: publicSession(session), replay: false };
    });
  }

  /** Aplica un turno completo, sus mensajes y eventos de forma atomica. */
  async finish(id: string, userId: string, companyId: string, requestId: string, message: string, result: IntakeResult): Promise<IntakeSession> {
    return this.db.runTransaction(async tx => {
      const ref = this.ref(id);
      const doc = await tx.get(ref);
      const stored = requireOwnedSession(doc.data() as StoredSession | undefined, userId, companyId);
      if (stored.pending?.requestId !== requestId) throw new ApiError('La conversacion cambio. Actualizala antes de continuar.', 409);
      const now = new Date().toISOString();
      const session: IntakeSession = {
        ...publicSession(stored), ...result, version: stored.version + 1, updatedAt: now,
        status: result.readyToCreateJob ? 'ready' : 'active',
        messages: [...stored.messages,
          { id: requestId + '-user', role: 'user', content: message, createdAt: now },
          { id: requestId + '-assistant', role: 'assistant', content: result.message, createdAt: now }],
      };
      tx.update(ref, { ...session, pending: null });
      this.event(tx, 'intake_message_sent', session);
      if (result.readyToCreateJob && !stored.readyToCreateJob) this.event(tx, 'intake_completed', session);
      return session;
    });
  }

  /** Libera solo el turno que fallo, conservando el ultimo contexto valido. */
  async release(id: string, requestId: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.ref(id);
      const doc = await tx.get(ref);
      const stored = doc.data() as StoredSession | undefined;
      if (stored?.pending?.requestId === requestId) tx.update(ref, { pending: null });
    });
  }

  /** Publica una sola vez el resumen confirmado, aun ante doble click o reintento. */
  async publish(id: string, userId: string, companyId: string, version: number, build: (session: IntakeSession) => Trabajo): Promise<IntakeSession> {
    return this.db.runTransaction(async tx => {
      const ref = this.ref(id);
      const doc = await tx.get(ref);
      const stored = requireOwnedSession(doc.data() as StoredSession | undefined, userId, companyId);
      if (stored.status === 'published') return publicSession(stored);
      this.assertMutable(stored, version);
      if (!stored.readyToCreateJob) throw new ApiError('Todavia falta informacion para publicar.', 409);
      const job = build(publicSession(stored));
      const session: IntakeSession = { ...publicSession(stored), status: 'published', jobId: job.id, version: stored.version + 1, updatedAt: new Date().toISOString() };
      tx.create(this.db.collection(COLECCIONES.TRABAJOS).doc(job.id), job);
      tx.update(ref, { ...session, pending: null, confirmedAt: new Date(), confirmedVersion: stored.version });
      this.event(tx, 'job_created_from_ai', session);
      return session;
    });
  }

  /** Registra abandono explicito sin borrar el historial ni crear trabajos. */
  async abandon(id: string, userId: string, companyId: string, version: number): Promise<IntakeSession> {
    return this.db.runTransaction(async tx => {
      const ref = this.ref(id);
      const doc = await tx.get(ref);
      const stored = requireOwnedSession(doc.data() as StoredSession | undefined, userId, companyId);
      if (stored.status === 'abandoned') return publicSession(stored);
      this.assertMutable(stored, version);
      const session: IntakeSession = { ...publicSession(stored), status: 'abandoned', readyToCreateJob: false, version: stored.version + 1, updatedAt: new Date().toISOString() };
      tx.update(ref, { ...session, pending: null });
      this.event(tx, 'intake_abandoned', session);
      return session;
    });
  }

  /** Rechaza ediciones obsoletas y conversaciones cerradas o con un turno en curso. */
  private assertMutable(session: StoredSession, version: number): void {
    if (session.version !== version || session.status === 'published' || session.status === 'abandoned') {
      throw new ApiError('La conversacion cambio o ya esta cerrada. Actualizala para continuar.', 409);
    }
    if (session.pending && session.pending.expiresAt > Date.now()) throw new ApiError('La IA sigue analizando el mensaje anterior. Espera un momento.', 409);
  }
}
export const intakeRepository = new IntakeRepository();
