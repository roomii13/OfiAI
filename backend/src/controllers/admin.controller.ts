/**
 * @archivo admin.controller.ts
 * @descripcion Controlador de administración para OfiAI.
 * Expone métricas, usuarios, suspensión de cuentas y reportes operativos.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { RequestAutenticada } from '../middleware/auth.middleware';

/**
 * Cuenta documentos de una colección sin aplicar filtros.
 */
async function contarColeccion(nombre: string): Promise<number> {
  const snapshot = await firestore.collection(nombre).get();
  return snapshot.size;
}

/**
 * Obtiene métricas administrativas básicas.
 */
export const obtenerMetricas = async (_req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [usuarios, empresas, profesionales, trabajos, suscripciones] = await Promise.all([
      contarColeccion(COLECCIONES.USUARIOS),
      contarColeccion(COLECCIONES.EMPRESAS),
      contarColeccion(COLECCIONES.PROFESIONALES),
      contarColeccion(COLECCIONES.TRABAJOS),
      contarColeccion(COLECCIONES.SUSCRIPCIONES),
    ]);

    res.status(200).json({
      exito: true,
      mensaje: 'Métricas administrativas obtenidas correctamente.',
      datos: {
        usuarios,
        empresas,
        profesionales,
        trabajos,
        suscripciones,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lista usuarios recientes para administración.
 */
export const listarUsuarios = async (_req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
  try {
    const snapshot = await firestore
      .collection(COLECCIONES.USUARIOS)
      .orderBy('fechaCreacion', 'desc')
      .limit(50)
      .get();

    res.status(200).json({
      exito: true,
      mensaje: 'Usuarios listados correctamente.',
      datos: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspende o reactiva un usuario.
 */
export const suspenderUsuario = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuarioId = req.params.id;
    const activo: unknown = req.body?.activo;
    if (typeof activo !== 'boolean' || (usuarioId === req.usuario?.uid && !activo)) {
      res.status(400).json({ exito: false, mensaje: 'Estado invalido o suspension de la cuenta propia.' });
      return;
    }

    if (!usuarioId) {
      res.status(400).json({
        exito: false,
        mensaje: 'El id de usuario es obligatorio.',
      });
      return;
    }

    await firestore.collection(COLECCIONES.USUARIOS).doc(usuarioId).update({
      activo,
      fechaActualizacion: new Date(),
    });

    res.status(200).json({
      exito: true,
      mensaje: activo ? 'Usuario reactivado correctamente.' : 'Usuario suspendido correctamente.',
      datos: { usuarioId, activo },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Devuelve un reporte administrativo resumido.
 */
export const obtenerReporte = async (_req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [eventos, notificaciones] = await Promise.all([
      contarColeccion(COLECCIONES.ANALYTICS_EVENTOS),
      contarColeccion(COLECCIONES.NOTIFICACIONES),
    ]);

    res.status(200).json({
      exito: true,
      mensaje: 'Reporte administrativo generado correctamente.',
      datos: {
        periodo: 'actual',
        eventosAnalytics: eventos,
        notificaciones,
        generadoEn: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
