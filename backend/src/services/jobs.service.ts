/**
 * @archivo jobs.service.ts
 * @descripcion Servicio de negocio para trabajos de OfiAI.
 * Maneja publicación, consulta, actualización, cancelación y filtros con permisos de empresa/admin.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Trabajo } from '../models/Job';
import { RolUsuario } from '../models/User';
import { companyRepository } from '../repositories/company.repository';
import { professionalRepository } from '../repositories/professional.repository';
import { jobsRepository, FiltrosTrabajos } from '../repositories/jobs.repository';
import { DatosActualizarTrabajo, DatosCrearTrabajo } from '../validators/job.validator';
import { publicarEventoTrabajoCreado } from '../events/job-created.event';

/**
 * Servicio de trabajos.
 */
class JobsService {
  /**
   * Crea un trabajo para la empresa del usuario autenticado.
   */
  async crearTrabajo(usuarioId: string, datos: DatosCrearTrabajo): Promise<Trabajo> {
    const empresa = await companyRepository.findByUsuarioId(usuarioId);

    if (!empresa) {
      throw new ApiError('No existe una empresa activa asociada al usuario.', 404);
    }

    const job = await jobsRepository.create(this.prepararTrabajo(empresa.id, datos));
    if (job.estado === 'publicado') {
      await publicarEventoTrabajoCreado({ trabajoId: job.id, empresaId: job.empresaId,
        categoria: job.categoria, ciudad: job.ciudad ?? '', timestamp: new Date() });
    }
    return job;
  }

  /** Construye un Job reutilizable para altas normales y publicacion transaccional de IA. */
  prepararTrabajo(empresaId: string, datos: DatosCrearTrabajo, id?: string): Trabajo {
    const fechaActual = new Date();
    const trabajo: Trabajo = {
      id: id ?? firestore.collection(COLECCIONES.TRABAJOS).doc().id,
      empresaId,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      categoria: datos.categoria,
      subcategoria: datos.subcategoria,
      habilidadesRequeridas: datos.habilidadesRequeridas,
      presupuestoMinimo: datos.presupuestoMinimo,
      presupuestoMaximo: datos.presupuestoMaximo,
      moneda: datos.moneda ?? 'ARS',
      tipoTrabajo: datos.tipoTrabajo,
      ciudad: datos.ciudad,
      direccion: datos.direccion,
      coordenadas: datos.coordenadas,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      estado: datos.estado ?? 'publicado',
      propuestasRecibidas: 0,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    return trabajo;
  }

  /**
   * Obtiene un trabajo por ID.
   */
  async obtenerTrabajo(id: string): Promise<Trabajo> {
    const trabajo = await jobsRepository.findById(id);

    if (!trabajo) {
      throw new ApiError('Trabajo no encontrado.', 404);
    }

    return trabajo;
  }

  /**
   * Lista trabajos con filtros.
   */
  async listarTrabajos(filtros: FiltrosTrabajos): Promise<Trabajo[]> {
    return jobsRepository.findAll(filtros);
  }

  /** Limita consultas a la empresa propia o a oportunidades publicadas. */
  async listarVisibles(usuarioId: string, rol: RolUsuario, filtros: FiltrosTrabajos): Promise<Trabajo[]> {
    if (rol === 'admin') return this.listarTrabajos(filtros);
    if (rol === 'empresa') {
      const empresa = await companyRepository.findByUsuarioId(usuarioId);
      if (!empresa) return [];
      return this.listarTrabajos({ ...filtros, empresaId: empresa.id });
    }
    return this.listarTrabajos({ ...filtros, estado: 'publicado' });
  }

  /** Protege borradores y trabajos privados de otros usuarios. */
  async obtenerVisible(id: string, usuarioId: string, rol: RolUsuario): Promise<Trabajo> {
    const trabajo = await this.obtenerTrabajo(id);
    if (rol === 'admin') return trabajo;
    if (rol === 'empresa') {
      await this.validarPropiedadEmpresa(trabajo, usuarioId, rol);
      return trabajo;
    }
    if (trabajo.estado === 'publicado') return trabajo;
    const profesional = await professionalRepository.findByUsuarioId(usuarioId);
    if (!profesional || trabajo.profesionalAsignadoId !== profesional.id) {
      throw new ApiError('No tienes acceso a este trabajo.', 403);
    }
    return trabajo;
  }

  /**
   * Actualiza un trabajo validando permisos.
   */
  async actualizarTrabajo(
    id: string,
    usuarioId: string,
    rol: RolUsuario,
    datos: DatosActualizarTrabajo
  ): Promise<Trabajo> {
    const trabajo = await this.obtenerTrabajo(id);
    await this.validarPropiedadEmpresa(trabajo, usuarioId, rol);
    await jobsRepository.update(id, datos);
    return this.obtenerTrabajo(id);
  }

  /**
   * Cancela un trabajo validando permisos.
   */
  async cancelarTrabajo(id: string, usuarioId: string, rol: RolUsuario): Promise<Trabajo> {
    const trabajo = await this.obtenerTrabajo(id);
    await this.validarPropiedadEmpresa(trabajo, usuarioId, rol);
    await jobsRepository.update(id, { estado: 'cancelado' });
    return this.obtenerTrabajo(id);
  }

  /**
   * Verifica que el usuario sea propietario de la empresa del trabajo o administrador.
   */
  private async validarPropiedadEmpresa(trabajo: Trabajo, usuarioId: string, rol: RolUsuario): Promise<void> {
    if (rol === 'admin') {
      return;
    }

    const empresa = await companyRepository.findByUsuarioId(usuarioId);

    if (!empresa || empresa.id !== trabajo.empresaId) {
      throw new ApiError('No tienes autorización para modificar este trabajo.', 403);
    }
  }
}

export const jobsService = new JobsService();
