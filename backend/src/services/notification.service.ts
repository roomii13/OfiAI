import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo notification.service.ts
 * @descripcion Servicio de notificaciones multicanal para OfiAI.
 * Envía email con Resend, WhatsApp, push con Firebase e internas con sistema de reintentos.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { firebaseMessaging } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { CanalNotificacion, Notificacion, TipoNotificacion } from '../models/Notification';
import { Usuario } from '../models/User';
import { notificationRepository } from '../repositories/notification.repository';
import { userRepository } from '../repositories/user.repository';
import { enviarEmailResend } from '../integrations/resend';
import { enviarMensajeWhatsApp } from '../integrations/whatsapp';
import { renderizarPlantillaNotificacion, DatosPlantillaNotificacion } from '../notifications/templates';
import { logger } from '../config/logger';

export interface EntradaCrearNotificacion {
  usuarioId: string;
  tipo: TipoNotificacion;
  canales: CanalNotificacion[];
  titulo?: string;
  mensaje?: string;
  datos?: DatosPlantillaNotificacion & Record<string, string | number | boolean | undefined>;
  destinatario?: {
    email?: string;
    telefono?: string;
    pushToken?: string;
  };
  programadaPara?: Date;
}

/**
 * Servicio de notificaciones transaccionales y operativas.
 */
class NotificationService {
  private readonly maxIntentosDefecto = 3;

  /**
   * Crea una notificación por cada canal solicitado y dispara envío inmediato si corresponde.
   */
  async crearYEnviar(entrada: EntradaCrearNotificacion): Promise<Notificacion[]> {
    if (entrada.canales.length === 0) {
      throw new ApiError('Debe indicarse al menos un canal de notificación.', 400);
    }

    const usuario = await this.obtenerUsuario(entrada.usuarioId);
    const plantilla = renderizarPlantillaNotificacion(entrada.tipo, entrada.datos);
    const canales = entrada.canales.filter(canal => canal === 'sms' || usuario.preferenciasNotificaciones?.[canal] !== false);
    const notificaciones = await Promise.all(canales.map((canal) =>
      this.crearNotificacion({
        ...entrada,
        canal,
        titulo: entrada.titulo ?? plantilla.titulo,
        mensaje: entrada.mensaje ?? plantilla.mensaje,
        destinatario: this.resolverDestinatario(usuario, entrada.destinatario),
      })
    ));

    await Promise.all(notificaciones.map((notificacion) => this.enviarNotificacion(notificacion.id)));

    return notificaciones;
  }

  /**
   * Envía una notificación pendiente por su canal.
   */
  async enviarNotificacion(notificacionId: string): Promise<void> {
    const notificacion = await notificationRepository.findById(notificacionId);

    if (!notificacion) {
      throw new ApiError('Notificación no encontrada.', 404);
    }

    if (notificacion.programadaPara && this.obtenerTiempo(notificacion.programadaPara) > Date.now()) {
      return;
    }

    try {
      await this.enviarPorCanal(notificacion);
      await notificationRepository.update(notificacion.id, {
        estado: 'enviada',
        enviada: true,
        fechaEnvio: new Date(),
        errorEnvio: undefined,
      });
    } catch (error) {
      await this.programarReintento(notificacion, error);
    }
  }

  /**
   * Procesa notificaciones pendientes o fallidas con reintento disponible.
   */
  async procesarReintentos(limite = 50): Promise<{ procesadas: number }> {
    const pendientes = await notificationRepository.findRetryable(limite);
    await Promise.all(pendientes.map((notificacion) => this.enviarNotificacion(notificacion.id)));

    return { procesadas: pendientes.length };
  }

  /**
   * Lista notificaciones internas de un usuario.
   */
  async listarInternas(usuarioId: string): Promise<Notificacion[]> {
    const notificaciones = await notificationRepository.findByUserId(usuarioId);
    return notificaciones
      .filter((notificacion) => notificacion.canal === 'in_app')
      .sort((a, b) => this.obtenerTiempo(b.fechaCreacion) - this.obtenerTiempo(a.fechaCreacion));
  }

  /**
   * Marca una notificación como leída.
   */
  async marcarComoLeida(notificacionId: string, usuarioId: string): Promise<Notificacion> {
    const notificacion = await notificationRepository.findById(notificacionId);

    if (!notificacion) {
      throw new ApiError('Notificación no encontrada.', 404);
    }

    if (notificacion.usuarioId !== usuarioId) {
      throw new ApiError('No tienes autorización para modificar esta notificación.', 403);
    }

    await notificationRepository.update(notificacionId, {
      leida: true,
      fechaLeida: new Date(),
    });

    const actualizada = await notificationRepository.findById(notificacionId);
    return actualizada as Notificacion;
  }

  /**
   * Crea una notificación en Firestore.
   */
  private async crearNotificacion(entrada: EntradaCrearNotificacion & { canal: CanalNotificacion; titulo: string; mensaje: string }): Promise<Notificacion> {
    const fechaActual = new Date();
    const notificacion: Notificacion = {
      id: firestore.collection(COLECCIONES.NOTIFICACIONES).doc().id,
      usuarioId: entrada.usuarioId,
      tipo: entrada.tipo,
      titulo: entrada.titulo,
      mensaje: entrada.mensaje,
      canal: entrada.canal,
      estado: entrada.programadaPara ? 'pendiente' : 'pendiente',
      leida: false,
      enviada: false,
      intentos: 0,
      maxIntentos: this.maxIntentosDefecto,
      datos: entrada.datos,
      destinatario: entrada.destinatario,
      fechaCreacion: fechaActual,
      programadaPara: entrada.programadaPara,
    };

    return notificationRepository.create(notificacion);
  }

  /**
   * Envía por canal específico.
   */
  private async enviarPorCanal(notificacion: Notificacion): Promise<void> {
    if (notificacion.canal === 'in_app') {
      return;
    }

    if (notificacion.canal === 'email') {
      await enviarEmailResend({
        to: this.requerirDestino(notificacion.destinatario?.email, 'email'),
        subject: notificacion.titulo,
        text: notificacion.mensaje,
        html: renderizarPlantillaNotificacion(notificacion.tipo, notificacion.datos as DatosPlantillaNotificacion | undefined).html,
      });
      return;
    }

    if (notificacion.canal === 'whatsapp') {
      await enviarMensajeWhatsApp({
        to: this.requerirDestino(notificacion.destinatario?.telefono, 'WhatsApp'),
        message: `${notificacion.titulo}\n${notificacion.mensaje}`,
      });
      return;
    }

    if (notificacion.canal === 'push') {
      await firebaseMessaging.send({
        token: this.requerirDestino(notificacion.destinatario?.pushToken, 'push token'),
        notification: {
          title: notificacion.titulo,
          body: notificacion.mensaje,
        },
        data: this.convertirDatosPush(notificacion.datos),
      });
      return;
    }

    logger.warn(`Canal de notificación no soportado todavía: ${notificacion.canal}`);
  }

  /**
   * Programa reintento con backoff exponencial o marca fallo final.
   */
  private async programarReintento(notificacion: Notificacion, error: unknown): Promise<void> {
    const intentos = notificacion.intentos + 1;
    const mensajeError = error instanceof Error ? error.message : 'Error desconocido al enviar notificación.';

    if (intentos >= notificacion.maxIntentos) {
      await notificationRepository.update(notificacion.id, {
        intentos,
        estado: 'fallida',
        errorEnvio: mensajeError,
      });
      return;
    }

    const proximoIntento = new Date(Date.now() + Math.pow(2, intentos) * 60 * 1000);

    await notificationRepository.update(notificacion.id, {
      intentos,
      estado: 'reintentando',
      proximoIntento,
      errorEnvio: mensajeError,
    });
  }

  /**
   * Obtiene usuario receptor.
   */
  private async obtenerUsuario(usuarioId: string): Promise<Usuario> {
    const usuario = await userRepository.findById(usuarioId);

    if (!usuario) {
      throw new ApiError('Usuario destinatario no encontrado.', 404);
    }

    return usuario;
  }

  /**
   * Resuelve destinos externos combinando usuario y datos explícitos.
   */
  private resolverDestinatario(
    usuario: Usuario,
    destinatario?: EntradaCrearNotificacion['destinatario']
  ): Notificacion['destinatario'] {
    return {
      email: destinatario?.email ?? usuario.email,
      telefono: destinatario?.telefono ?? usuario.telefono,
      pushToken: destinatario?.pushToken,
    };
  }

  /**
   * Valida destino requerido para un canal externo.
   */
  private requerirDestino(valor: string | undefined, nombre: string): string {
    if (!valor) {
      throw new Error(`Falta destino para canal ${nombre}.`);
    }

    return valor;
  }

  /**
   * Convierte metadata simple en datos de Firebase Messaging.
   */
  private convertirDatosPush(datos?: Record<string, unknown>): Record<string, string> {
    if (!datos) {
      return {};
    }

    return Object.entries(datos).reduce<Record<string, string>>((acumulado, [clave, valor]) => {
      if (['string', 'number', 'boolean'].includes(typeof valor)) {
        acumulado[clave] = String(valor);
      }
      return acumulado;
    }, {});
  }

  /**
   * Convierte Date o Timestamp Firestore en milisegundos.
   */
  private obtenerTiempo(fecha: Date | FirebaseFirestore.Timestamp): number {
    return fecha instanceof Date ? fecha.getTime() : fecha.toDate().getTime();
  }
}

export const notificationService = new NotificationService();
