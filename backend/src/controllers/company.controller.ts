/**
 * @archivo company.controller.ts
 * @descripcion Controlador HTTP para el módulo de Empresas en OfiAI.
 * Maneja solicitudes HTTP de CRUD, búsqueda, paginación y eliminación lógica de empresas.
 * @modulo Controllers
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { companyService } from '../services/company.service';

class CompanyController {
  /**
   * Crear un nuevo perfil de empresa.
   */
  crearEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.usuario?.uid;
      if (!usuarioId) {
        res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado.' });
        return;
      }

      const empresa = await companyService.createCompany(usuarioId, req.body);
      res.status(201).json({
        exito: true,
        mensaje: 'Perfil de empresa creado exitosamente.',
        datos: empresa,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtener detalles de una empresa por ID.
   */
  obtenerEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const empresa = await companyService.getCompanyById(id!);
      res.status(200).json({
        exito: true,
        datos: empresa,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtener el perfil de la empresa vinculada al usuario en sesión.
   */
  obtenerMiEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.usuario?.uid;
      if (!usuarioId) {
        res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado.' });
        return;
      }

      const empresa = await companyService.getCompanyByUserId(usuarioId);
      res.status(200).json({
        exito: true,
        datos: empresa,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Listar empresas activas con paginación y filtros.
   */
  listarEmpresas = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filtros = {
        industria: req.query.industria as string | undefined,
        tamanoEmpresa: req.query.tamanoEmpresa as string | undefined,
        ciudad: req.query.ciudad as string | undefined,
        pais: req.query.pais as string | undefined,
        pagina: req.query.pagina ? parseInt(req.query.pagina as string, 10) : 1,
        limite: req.query.limite ? parseInt(req.query.limite as string, 10) : 10,
      };

      const resultado = await companyService.listCompanies(filtros);
      res.status(200).json({
        exito: true,
        datos: resultado.empresas,
        paginacion: {
          total: resultado.total,
          pagina: resultado.pagina,
          limite: resultado.limite,
          totalPaginas: resultado.totalPaginas,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualizar perfil de empresa.
   */
  actualizarEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const usuarioId = req.usuario?.uid;
      const rol = req.usuario?.rol;

      if (!usuarioId || !rol) {
        res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado.' });
        return;
      }

      const empresa = await companyService.updateCompany(id!, usuarioId, rol, req.body);
      res.status(200).json({
        exito: true,
        mensaje: 'Perfil de empresa actualizado exitosamente.',
        datos: empresa,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Eliminar lógicamente (soft delete) una empresa.
   */
  eliminarEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const usuarioId = req.usuario?.uid;
      const rol = req.usuario?.rol;

      if (!usuarioId || !rol) {
        res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado.' });
        return;
      }

      await companyService.deleteCompany(id!, usuarioId, rol);
      res.status(200).json({
        exito: true,
        mensaje: 'Empresa eliminada exitosamente.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const companyController = new CompanyController();
