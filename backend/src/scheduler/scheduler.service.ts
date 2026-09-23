/**
 * @archivo scheduler.service.ts
 * @descripcion Servicio de tareas programadas para procesos automáticos de OfiAI.
 * Ejecuta recordatorios, renovaciones, limpieza de datos, reintentos de notificaciones y reportes.
 * @modulo Scheduler
 */

import cron, { ScheduledTask } from 'node-cron';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Trabajo } from '../models/Job';
import { Profesional } from '../models/Professional';
import { Suscripcion } from '../models/Subscription';
import { Empresa } from '../models/Company';
import { analyticsWorker } from '../workers/analytics.worker';
import { notificationRetriesWorker } from '../workers/notifications.worker';
import { notificationService } from '../services/notification.service';

export type TareaProgramadaNombre =
  | 'recordatorios'
  | 'renovaciones'
  | 'limpieza_datos'
  | 'reintentos_notificaciones'
  | 'analytics_diario';

export interface ResultadoTareaProgramada {
  tarea: TareaProgramadaNombre;
  procesados: number;
  fechaEjecucion: string;
}

/**
 * Orquestador de tareas recurrentes del backend.
 */
class SchedulerService {
  private tareas: ScheduledTask[] = [];

  /**
   * Inicia todas las tareas programadas si el scheduler está habilitado.
   */
  start(): void {
    if (!env.SCHEDULER_ENABLED) {
      logger.info('Scheduler deshabilitado por configuración.');
      return;
    }

    if (this.tareas.length > 0) {
      return;
    }

    this.tareas = [
      cron.schedule('*/10 * * * *', () => this.ejecutarSeguro('reintentos_notificaciones')),
      cron.schedule('0 9 * * *', () => this.ejecutarSeguro('recordatorios')),
      cron.schedule('30 9 * * *', () => this.ejecutarSeguro('renovaciones')),
      cron.schedule('0 3 * * *', () => this.ejecutarSeguro('limpieza_datos')),
      cron.schedule('30 3 * * *', () => this.ejecutarSeguro('analytics_diario')),
    ];

    logger.info('Scheduler de OfiAI iniciado correctamente.');
  }

  /**
   * Detiene todas las tareas programadas activas.
   */
  stop(): void {
    this.tareas.forEach((tarea) => tarea.stop());
    this.tareas = [];
    logger.info('Scheduler de OfiAI detenido correctamente.');
  }

  /**
   * Ejecuta una tarea por nombre para uso manual o pruebas de integración.
   */
  async run(tarea: TareaProgramadaNombre): Promise<ResultadoTareaProgramada> {
    if (tarea === 'reintentos_notificaciones') {
      const resultado = await notificationRetriesWorker(100);
      return this.crearResultado(tarea, resultado.procesadas);
    }

    if (tarea === 'recordatorios') {
      const procesados = await this.procesarRecordatoriosTrabajos();
      return this.crearResultado(tarea, procesados);
    }

    if (tarea === 'renovaciones') {
      const procesados = await this.procesarRecordatoriosRenovacion();
      return this.crearResultado(tarea, procesados);
    }

    if (tarea === 'limpieza_datos') {
      const procesados = await this.procesarLimpiezaDatos();
      return this.crearResultado(tarea, procesados);
    }

    const reporte = await analyticsWorker('diario');
    return this.crearResultado(tarea, Object.keys(reporte.kpis).length);
  }

  /**
   * Ejecuta una tarea atrapando errores para que cron no detenga el proceso.
   */
  private async ejecutarSeguro(tarea: TareaProgramadaNombre): Promise<void> {
    try {
      const resultado = await this.run(tarea);
      logger.info(`Tarea programada ejecutada: ${tarea}`, resultado);
    } catch (error) {
      logger.error(`Error al ejecutar tarea programada: ${tarea}`, { error });
    }
  }

  /**
   * Envía recordatorios para trabajos próximos a iniciar en 24 horas.
   */
  private async procesarRecordatoriosTrabajos(): Promise<number> {
    const ahora = new Date();
    const hasta = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const snapshot = await firestore
      .collection(COLECCIONES.TRABAJOS)
      .where('fechaInicio', '>=', ahora)
      .where('fechaInicio', '<=', hasta)
      .limit(100)
      .get();
    const trabajos = snapshot.docs.map((doc) => doc.data() as Trabajo);

    await Promise.all(trabajos.map((trabajo) => this.notificarRecordatorioTrabajo(trabajo)));
    return trabajos.length;
  }

  /**
   * Envía recordatorios para suscripciones activas próximas a vencer.
   */
  private async procesarRecordatoriosRenovacion(): Promise<number> {
    const hasta = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const snapshot = await firestore
      .collection(COLECCIONES.SUSCRIPCIONES)
      .where('estado', '==', 'activa')
      .where('fechaVencimiento', '<=', hasta)
      .limit(100)
      .get();
    const suscripciones = snapshot.docs.map((doc) => doc.data() as Suscripcion);

    await Promise.all(suscripciones.map((suscripcion) =>
      notificationService.crearYEnviar({
        usuarioId: suscripcion.usuarioId,
        tipo: 'suscripcion_vencida',
        canales: ['in_app', 'email'],
        datos: {
          nombre: 'Hola',
          detalle: `Tu plan ${suscripcion.plan} vence pronto.`,
        },
      })
    ));

    return suscripciones.length;
  }

  /**
   * Limpia notificaciones fallidas antiguas para mantener Firestore liviano.
   */
  private async procesarLimpiezaDatos(): Promise<number> {
    const limiteFecha = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const snapshot = await firestore
      .collection(COLECCIONES.NOTIFICACIONES)
      .where('estado', '==', 'fallida')
      .where('fechaCreacion', '<=', limiteFecha)
      .limit(100)
      .get();

    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    return snapshot.size;
  }

  /**
   * Notifica a empresa y profesional asignado sobre un trabajo próximo.
   */
  private async notificarRecordatorioTrabajo(trabajo: Trabajo): Promise<void> {
    const empresaDoc = await firestore
      .collection(COLECCIONES.EMPRESAS)
      .doc(trabajo.empresaId)
      .get();
    const empresa = empresaDoc.exists ? empresaDoc.data() as Empresa : null;

    if (!empresa) {
      return;
    }

    await notificationService.crearYEnviar({
      usuarioId: empresa.usuarioId,
      tipo: 'alerta_sistema',
      canales: ['in_app'],
      datos: {
        tituloTrabajo: trabajo.titulo,
        detalle: `El trabajo ${trabajo.titulo} inicia pronto.`,
      },
    });

    if (!trabajo.profesionalAsignadoId) {
      return;
    }

    const profesionalDoc = await firestore
      .collection(COLECCIONES.PROFESIONALES)
      .doc(trabajo.profesionalAsignadoId)
      .get();
    const profesional = profesionalDoc.exists ? profesionalDoc.data() as Profesional : null;

    if (!profesional) {
      return;
    }

    await notificationService.crearYEnviar({
      usuarioId: profesional.usuarioId,
      tipo: 'alerta_sistema',
      canales: ['in_app'],
      datos: {
        tituloTrabajo: trabajo.titulo,
        detalle: `Tienes un trabajo asignado que inicia pronto: ${trabajo.titulo}.`,
      },
    });
  }

  /**
   * Crea una respuesta uniforme para ejecución de tareas.
   */
  private crearResultado(tarea: TareaProgramadaNombre, procesados: number): ResultadoTareaProgramada {
    return {
      tarea,
      procesados,
      fechaEjecucion: new Date().toISOString(),
    };
  }
}

export const schedulerService = new SchedulerService();
