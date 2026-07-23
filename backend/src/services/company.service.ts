/**
 * @archivo company.service.ts
 * @descripcion Servicio de lógica de negocio para la gestión de Empresas en OfiAI.
 * Maneja las operaciones CRUD, verificaciones de propiedad y filtrado para contratantes.
 * @modulo Services
 */

import { companyRepository, FiltrosConsultaEmpresa, ResultadoPaginadoEmpresas } from '../repositories/company.repository';
import { Empresa } from '../models/Company';
import { RolUsuario } from '../models/User';
import { DatosCrearEmpresa, DatosActualizarEmpresa } from '../validators/company.validator';
import { ApiError } from '../middleware/error.middleware';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { logger } from '../config/logger';

class CompanyService {
  /**
   * Crea el perfil de una nueva empresa vinculada a una cuenta de usuario existente.
   */
  async createCompany(usuarioId: string, datos: DatosCrearEmpresa): Promise<Empresa> {
    const existente = await companyRepository.findByUsuarioId(usuarioId);
    if (existente) {
      throw new ApiError('El usuario ya posee un perfil de empresa creado.', 400);
    }

    const fechaActual = new Date();
    const id = firestore.collection(COLECCIONES.EMPRESAS).doc().id;

    const nuevaEmpresa: Empresa = {
      id,
      usuarioId,
      nombreEmpresa: datos.nombreEmpresa,
      industria: datos.industria,
      tamanoEmpresa: datos.tamanoEmpresa,
      pais: datos.pais,
      ciudad: datos.ciudad,
      descripcion: datos.descripcion,
      sitioWeb: datos.sitioWeb,
      rut: datos.rut,
      direccion: datos.direccion,
      suscripcionActiva: false,
      totalContrataciones: 0,
      calificacionPromedio: 5.0,
      activo: true,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    return await companyRepository.create(nuevaEmpresa);
  }

  /**
   * Obtiene la empresa por su ID.
   */
  async getCompanyById(id: string): Promise<Empresa> {
    const empresa = await companyRepository.findById(id);
    if (!empresa) {
      throw new ApiError('Empresa no encontrada.', 404);
    }
    return empresa;
  }

  /**
   * Obtiene la empresa vinculada al UID de usuario.
   */
  async getCompanyByUserId(usuarioId: string): Promise<Empresa> {
    const empresa = await companyRepository.findByUsuarioId(usuarioId);
    if (!empresa) {
      throw new ApiError('No se encontró un perfil de empresa registrado para este usuario.', 404);
    }
    return empresa;
  }

  /**
   * Consulta el catálogo paginado de empresas con filtros.
   */
  async listCompanies(filtros: FiltrosConsultaEmpresa): Promise<ResultadoPaginadoEmpresas> {
    return await companyRepository.findAll(filtros);
  }

  /**
   * Actualiza el perfil de una Empresa verificando permisos de propietario o Administrador.
   */
  async updateCompany(
    id: string,
    usuarioId: string,
    rol: RolUsuario,
    datos: DatosActualizarEmpresa
  ): Promise<Empresa> {
    const empresa = await this.getCompanyById(id);

    if (rol !== 'admin' && empresa.usuarioId !== usuarioId) {
      logger.warn(`Intento no autorizado de editar empresa ID: ${id} por usuario UID: ${usuarioId}`);
      throw new ApiError('No tienes autorización para modificar esta empresa.', 403);
    }

    await companyRepository.update(id, datos);
    return await this.getCompanyById(id);
  }

  /**
   * Realiza un Soft Delete de la empresa.
   */
  async deleteCompany(id: string, usuarioId: string, rol: RolUsuario): Promise<void> {
    const empresa = await this.getCompanyById(id);

    if (rol !== 'admin' && empresa.usuarioId !== usuarioId) {
      logger.warn(`Intento no autorizado de eliminar empresa ID: ${id} por usuario UID: ${usuarioId}`);
      throw new ApiError('No tienes autorización para eliminar esta empresa.', 403);
    }

    await companyRepository.softDelete(id);
  }
}

export const companyService = new CompanyService();
