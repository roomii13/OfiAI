import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo professional.repository.ts
 * @descripcion Repositorio Firestore para profesionales de OfiAI.
 * Centraliza creación, búsqueda, actualización y filtros de perfiles profesionales.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Profesional } from '../models/Professional';
import { FieldPath } from 'firebase-admin/firestore';
import { MATCHING_POLICY, MATCHING_PROFILE_FIELDS } from '../constants/matching';
import { isMatchingActive } from '../domain/matching/matching';

export interface FiltrosProfesionales {
  categoria?: string;
  especialidad?: string;
  ciudad?: string;
  pais?: string;
  disponible?: boolean;
  verificado?: boolean;
  limite: number;
}

/**
 * Repositorio de profesionales sobre Firestore.
 */
class ProfessionalRepository {
  /** Recorre paginas acotadas con proyeccion; incluye perfiles legados sin status y descarta bajas. */
  async findMatchingCandidates(): Promise<{ professionals: Profesional[]; scanned: number; limited: boolean }> {
    const professionals: Profesional[] = [];
    let scanned = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (scanned < MATCHING_POLICY.candidateLimit) {
      let query = this.coleccion.orderBy(FieldPath.documentId()).select(...MATCHING_PROFILE_FIELDS).limit(MATCHING_POLICY.candidatePageSize);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      scanned += page.size;
      for (const doc of page.docs) {
        const pro = { ...doc.data(), id: doc.id } as Profesional;
        if (isMatchingActive(pro)) professionals.push(pro);
      }
      if (page.size < MATCHING_POLICY.candidatePageSize) return { professionals, scanned, limited: false };
      cursor = page.docs[page.docs.length - 1];
    }
    return { professionals, scanned, limited: true };
  }

  /** Revalida un conjunto pequeno sin recuperar documentos privados completos. */
  async findMatchingByIds(ids: string[]): Promise<Profesional[]> {
    if (!ids.length) return [];
    const refs = [...new Set(ids)].map(id => this.coleccion.doc(id));
    const documents = await firestore.getAll(...refs, { fieldMask: [...MATCHING_PROFILE_FIELDS] });
    return documents.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id } as Profesional));
  }
  private get coleccion() {
    return firestore.collection(COLECCIONES.PROFESIONALES);
  }

  /**
   * Crea un perfil profesional.
   */
  async create(profesional: Profesional): Promise<Profesional> {
    await this.coleccion.doc(profesional.id).set(profesional);
    return profesional;
  }

  /**
   * Busca un profesional por ID.
   */
  async findById(id: string): Promise<Profesional | null> {
    const doc = await this.coleccion.doc(id).get();
    return doc.exists ? doc.data() as Profesional : null;
  }

  /**
   * Busca un profesional por usuarioId.
   */
  async findByUsuarioId(usuarioId: string): Promise<Profesional | null> {
    const snapshot = await this.coleccion.where('usuarioId', '==', usuarioId).limit(1).get();
    return snapshot.docs[0]?.data() as Profesional | undefined ?? null;
  }

  /**
   * Busca profesionales con filtros simples.
   */
  async findAll(filtros: FiltrosProfesionales): Promise<Profesional[]> {
    let query: FirebaseFirestore.Query = this.coleccion;

    if (typeof filtros.disponible === 'boolean') {
      query = query.where('disponible', '==', filtros.disponible);
    }
    if (typeof filtros.verificado === 'boolean') {
      query = query.where('verificado', '==', filtros.verificado);
    }
    if (filtros.ciudad) {
      query = query.where('ciudad', '==', filtros.ciudad);
    }
    if (filtros.pais) {
      query = query.where('pais', '==', filtros.pais);
    }

    const snapshot = await query.limit(filtros.limite).get();
    const profesionales = snapshot.docs.map((doc) => doc.data() as Profesional);

    return profesionales.filter((profesional) => {
      const coincideCategoria = filtros.categoria ? profesional.categorias.includes(filtros.categoria) : true;
      const coincideEspecialidad = filtros.especialidad ? profesional.especialidades.includes(filtros.especialidad) : true;
      return coincideCategoria && coincideEspecialidad;
    });
  }

  /**
   * Actualiza parcialmente un perfil profesional.
   */
  async update(id: string, data: Partial<Profesional>): Promise<void> {
    await this.coleccion.doc(id).update({
      ...data,
      fechaActualizacion: new Date(),
    });
  }
}

export const professionalRepository = new ProfessionalRepository();
