import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo company.repository.ts
 * @descripcion Capa de acceso a datos de Firestore para la colección 'companies'.
 * Maneja el CRUD completo, filtrado, búsquedas, paginación y soft delete de empresas en OfiAI.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Empresa } from '../models/Company';
import { logger } from '../config/logger';

export interface FiltrosConsultaEmpresa {
  industria?: string;
  tamanoEmpresa?: string;
  ciudad?: string;
  pais?: string;
  pagina: number;
  limite: number;
}

export interface ResultadoPaginadoEmpresas {
  empresas: Empresa[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

class CompanyRepository {
  private get coleccion() {
    return firestore.collection(COLECCIONES.EMPRESAS);
  }

  /**
   * Crea un nuevo registro de Empresa en Firestore.
   */
  async create(empresa: Empresa): Promise<Empresa> {
    try {
      await this.coleccion.doc(empresa.id).set({
        ...empresa,
        activo: true,
        fechaCreacion: empresa.fechaCreacion || new Date(),
        fechaActualizacion: empresa.fechaActualizacion || new Date(),
      });
      logger.info(`🏢 Empresa creada en Firestore ID: ${empresa.id}`);
      return empresa;
    } catch (error) {
      logger.error(`Error al crear empresa en Firestore ID: ${empresa.id}`, { error });
      throw error;
    }
  }

  /**
   * Obtiene una Empresa por su ID directo.
   */
  async findById(id: string): Promise<Empresa | null> {
    try {
      const doc = await this.coleccion.doc(id).get();
      if (!doc.exists) {
        return null;
      }
      const data = doc.data() as Empresa;
      return data.activo !== false ? data : null;
    } catch (error) {
      logger.error(`Error al buscar empresa por ID: ${id}`, { error });
      throw error;
    }
  }

  /**
   * Obtiene una Empresa asociada al usuarioId de la cuenta.
   */
  async findByUsuarioId(usuarioId: string): Promise<Empresa | null> {
    try {
      const snap = await this.coleccion
        .where('usuarioId', '==', usuarioId)
        .where('activo', '==', true)
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }
      return snap.docs[0]?.data() as Empresa;
    } catch (error) {
      logger.error(`Error al buscar empresa por usuarioId: ${usuarioId}`, { error });
      throw error;
    }
  }

  /**
   * Consulta paginada de empresas activas con filtros dinámicos.
   */
  async findAll(filtros: FiltrosConsultaEmpresa): Promise<ResultadoPaginadoEmpresas> {
    try {
      let query: FirebaseFirestore.Query = this.coleccion.where('activo', '==', true);

      if (filtros.industria) {
        query = query.where('industria', '==', filtros.industria);
      }
      if (filtros.tamanoEmpresa) {
        query = query.where('tamanoEmpresa', '==', filtros.tamanoEmpresa);
      }
      if (filtros.ciudad) {
        query = query.where('ciudad', '==', filtros.ciudad);
      }
      if (filtros.pais) {
        query = query.where('pais', '==', filtros.pais);
      }

      // Obtener conteo total
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Aplicar paginación
      const offset = (filtros.pagina - 1) * filtros.limite;
      const snapshot = await query
        .orderBy('fechaCreacion', 'desc')
        .offset(offset)
        .limit(filtros.limite)
        .get();

      const empresas = snapshot.docs.map((doc) => doc.data() as Empresa);
      const totalPaginas = Math.ceil(total / filtros.limite) || 1;

      return {
        empresas,
        total,
        pagina: filtros.pagina,
        limite: filtros.limite,
        totalPaginas,
      };
    } catch (error) {
      logger.error('Error al realizar búsqueda paginada de empresas:', { filtros, error });
      throw error;
    }
  }

  /**
   * Actualiza parcialmente la información de una Empresa.
   */
  async update(id: string, data: Partial<Empresa>): Promise<void> {
    try {
      await this.coleccion.doc(id).update({
        ...data,
        fechaActualizacion: new Date(),
      });
      logger.info(`🏢 Empresa actualizada en Firestore ID: ${id}`);
    } catch (error) {
      logger.error(`Error al actualizar empresa ID: ${id}`, { error });
      throw error;
    }
  }

  /**
   * Realiza Soft Delete marcando la empresa como inactiva (`activo: false`).
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.coleccion.doc(id).update({
        activo: false,
        fechaActualizacion: new Date(),
      });
      logger.info(`🏢 Empresa marcada como inactiva (Soft Delete) ID: ${id}`);
    } catch (error) {
      logger.error(`Error al realizar soft delete de empresa ID: ${id}`, { error });
      throw error;
    }
  }
}

export const companyRepository = new CompanyRepository();
