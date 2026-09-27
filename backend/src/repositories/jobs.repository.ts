import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo jobs.repository.ts
 * @descripcion Repositorio Firestore para trabajos publicados en OfiAI.
 * Centraliza creación, consulta, actualización y filtros de solicitudes de servicio.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { EstadoTrabajo, Trabajo } from '../models/Job';
import { ApiError } from '../middleware/error.middleware';
import { subscriptionRepository } from './subscription.repository';
import { jobAgentEvent } from '../events/agent.event';

export interface FiltrosTrabajos {
  empresaId?: string;
  estado?: EstadoTrabajo;
  categoria?: string;
  ciudad?: string;
  tipoTrabajo?: 'presencial' | 'remoto' | 'hibrido';
  limite: number;
}

/**
 * Repositorio de trabajos sobre Firestore.
 */
class JobsRepository {
  private get coleccion() {
    return firestore.collection(COLECCIONES.TRABAJOS);
  }

  /**
   * Crea un trabajo.
   */
  async create(trabajo: Trabajo): Promise<Trabajo> {
    await firestore.runTransaction(async tx => {
      const ref = this.coleccion.doc(trabajo.id);
      if ((await tx.get(ref)).exists) return;
      const company = (await tx.get(firestore.collection(COLECCIONES.EMPRESAS).doc(trabajo.empresaId))).data();
      if (!company?.usuarioId) throw new ApiError('Empresa no encontrada.', 404);
      if (trabajo.estado === 'publicado') await subscriptionRepository.consumeQuota(tx, String(company.usuarioId), 'empresa', 'trabajosPublicados');
      tx.create(ref, trabajo);
      if(trabajo.estado==='publicado') {
        const event=jobAgentEvent(trabajo.id,String(company.usuarioId));
        tx.create(firestore.collection(COLECCIONES.AGENT_EVENTS).doc(event.id),event);
      }
    });
    return trabajo;
  }

  /**
   * Busca un trabajo por ID.
   */
  async findById(id: string): Promise<Trabajo | null> {
    const doc = await this.coleccion.doc(id).get();
    return doc.exists ? doc.data() as Trabajo : null;
  }

  /**
   * Lista trabajos con filtros simples.
   */
  async findAll(filtros: FiltrosTrabajos): Promise<Trabajo[]> {
    let query: FirebaseFirestore.Query = this.coleccion;

    if (filtros.empresaId) {
      query = query.where('empresaId', '==', filtros.empresaId);
    }
    if (filtros.estado) {
      query = query.where('estado', '==', filtros.estado);
    }
    if (filtros.categoria) {
      query = query.where('categoria', '==', filtros.categoria);
    }
    if (filtros.ciudad) {
      query = query.where('ciudad', '==', filtros.ciudad);
    }
    if (filtros.tipoTrabajo) {
      query = query.where('tipoTrabajo', '==', filtros.tipoTrabajo);
    }

    const snapshot = await query.limit(filtros.limite).get();
    return snapshot.docs.map((doc) => doc.data() as Trabajo);
  }

  /**
   * Actualiza parcialmente un trabajo.
   */
  async update(id: string, data: Partial<Trabajo>): Promise<void> {
    await firestore.runTransaction(async tx => {
      const ref = this.coleccion.doc(id);
      const snapshot = await tx.get(ref);
      const current = snapshot.data() as Trabajo | undefined;
      if (current?.estado === 'borrador' && data.estado === 'publicado') {
        const company = (await tx.get(firestore.collection(COLECCIONES.EMPRESAS).doc(current.empresaId))).data();
        if (!company?.usuarioId) throw new ApiError('Empresa no encontrada.', 404);
        await subscriptionRepository.consumeQuota(tx, String(company.usuarioId), 'empresa', 'trabajosPublicados');
        const event=jobAgentEvent(id,String(company.usuarioId));
        tx.create(firestore.collection(COLECCIONES.AGENT_EVENTS).doc(event.id),event);
      }
      if (current?.coordinationState && current.coordinationState !== 'CANCELLED') {
        throw new ApiError('Este trabajo se gestiona desde Coordinacion para conservar los acuerdos.', 409);
      }
      const updated = { ...current, ...data, fechaActualizacion: new Date() };
      const aliases = current?.source === 'ai_intake' ? {
        title: updated.titulo, description: updated.descripcion, category: updated.categoria,
        status: updated.estado, updatedAt: updated.fechaActualizacion,
        location: { ...current.location, city: updated.ciudad ?? current.location?.city ?? null },
        budget: { ...current.budget, min: updated.presupuestoMinimo ?? current.budget?.min ?? null, max: updated.presupuestoMaximo ?? current.budget?.max ?? null, currency: data.moneda ?? current.budget?.currency ?? null },
        requirements: updated.habilidadesRequeridas,
      } : {};
      const matchingChanged = Object.keys(data).some(key =>
        ['titulo', 'descripcion', 'categoria', 'subcategoria', 'habilidadesRequeridas', 'ciudad',
          'coordenadas', 'presupuestoMinimo', 'presupuestoMaximo', 'moneda', 'fechaInicio',
          'tipoTrabajo', 'estado', 'location', 'urgency', 'requirements', 'preferredDate', 'estimatedScope'].includes(key));
      tx.update(ref, { ...data, ...aliases, ...(matchingChanged ? { matchingStatus: 'pending', matchingSelection: null } : {}),
        fechaActualizacion: updated.fechaActualizacion });
    });
  }
}

export const jobsRepository = new JobsRepository();
