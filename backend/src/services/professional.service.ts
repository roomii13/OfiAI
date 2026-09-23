/**
 * @archivo professional.service.ts
 * @descripcion Servicio de negocio para profesionales de OfiAI.
 * Maneja creación, búsqueda, actualización y permisos de perfiles profesionales.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Profesional } from '../models/Professional';
import { RolUsuario } from '../models/User';
import { professionalRepository, FiltrosProfesionales } from '../repositories/professional.repository';
import { userRepository } from '../repositories/user.repository';
import { DatosActualizarProfesional, DatosCrearProfesional } from '../validators/professional.validator';

/**
 * Servicio de profesionales.
 */
class ProfessionalService {
  /**
   * Crea un perfil profesional vinculado al usuario autenticado.
   */
  async crearProfesional(usuarioId: string, datos: DatosCrearProfesional): Promise<Profesional> {
    const existente = await professionalRepository.findByUsuarioId(usuarioId);

    if (existente) {
      throw new ApiError('El usuario ya posee un perfil profesional.', 400);
    }

    const usuario = await userRepository.findById(usuarioId);

    if (!usuario) {
      throw new ApiError('Usuario no encontrado para crear perfil profesional.', 404);
    }

    const fechaActual = new Date();
    const profesional: Profesional = {
      status: 'active',
      habilidades: datos.habilidades,
      provincia: datos.provincia,
      radioServicioKm: datos.radioServicioKm,
      precioMinimo: datos.precioMinimo,
      disponibilidadHoraria: datos.disponibilidadHoraria,
      id: firestore.collection(COLECCIONES.PROFESIONALES).doc().id,
      usuarioId,
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? '',
      especialidades: datos.especialidades,
      categorias: datos.categorias,
      descripcionPerfil: datos.descripcionPerfil,
      aniosExperiencia: datos.aniosExperiencia,
      tarifaHora: datos.tarifaHora,
      tarifaHoraMateriales: datos.tarifaHoraMateriales,
      tarifaHoraImpuestos: datos.tarifaHoraImpuestos,
      tarifaHoraActualizadaAt: datos.tarifaHora === undefined ? undefined : fechaActual,
      tarifaServicio: datos.tarifaServicio,
      moneda: datos.moneda ?? 'ARS',
      disponible: true,
      pais: usuario.pais,
      ciudad: datos.ciudad,
      zonaCobertura: datos.zonaCobertura,
      coordenadas: datos.coordenadas,
      calificacionPromedio: 5,
      totalResenas: 0,
      totalTrabajos: 0,
      verificado: false,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    return professionalRepository.create(profesional);
  }

  /**
   * Obtiene un profesional por ID.
   */
  async obtenerProfesional(id: string): Promise<Profesional> {
    const profesional = await professionalRepository.findById(id);

    if (!profesional) {
      throw new ApiError('Profesional no encontrado.', 404);
    }

    return profesional;
  }

  /**
   * Obtiene el perfil profesional del usuario autenticado.
   */
  async obtenerMiPerfil(usuarioId: string): Promise<Profesional> {
    const profesional = await professionalRepository.findByUsuarioId(usuarioId);

    if (!profesional) {
      throw new ApiError('No existe un perfil profesional asociado al usuario.', 404);
    }

    return profesional;
  }

  /**
   * Busca profesionales con filtros.
   */
  async buscarProfesionales(filtros: FiltrosProfesionales): Promise<Profesional[]> {
    return professionalRepository.findAll(filtros);
  }

  /**
   * Actualiza un profesional verificando propietario o administrador.
   */
  async actualizarProfesional(
    id: string,
    usuarioId: string,
    rol: RolUsuario,
    datos: DatosActualizarProfesional
  ): Promise<Profesional> {
    const profesional = await this.obtenerProfesional(id);

    if (rol !== 'admin' && profesional.usuarioId !== usuarioId) {
      throw new ApiError('No tienes autorización para modificar este perfil profesional.', 403);
    }

    if (rol !== 'admin' && datos.verificado !== undefined) {
      throw new ApiError('La verificacion del perfil requiere administracion.', 403);
    }

    await professionalRepository.update(id, { ...datos,
      ...(datos.tarifaHora !== undefined || datos.tarifaHoraMateriales !== undefined || datos.tarifaHoraImpuestos !== undefined
        ? { tarifaHoraActualizadaAt: new Date() } : {}) });
    return this.obtenerProfesional(id);
  }
}

export const professionalService = new ProfessionalService();
