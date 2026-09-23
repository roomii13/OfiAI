/**
 * @archivo subscription.service.ts
 * @descripcion Servicio de negocio para suscripciones SaaS de OfiAI.
 * Implementa planes, checkout, renovaciones, cancelaciones, historial y webhooks con Mercado Pago.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Suscripcion, PlanSuscripcion, EstadoSuscripcion } from '../models/Subscription';
import { HistorialSuscripcion, ResultadoCheckoutSuscripcion } from '../models/subscription.model';
import { RolUsuario, Usuario } from '../models/User';
import { env } from '../config/env';
import { PLANES_POR_ID, obtenerPlanSuscripcion, IdPlanSuscripcion } from '../constants/subscriptionPlans';
import { DatosCancelarSuscripcion, DatosSuscribirse } from '../validators/subscription.validator';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { userRepository } from '../repositories/user.repository';
import {
  cancelarPreapprovalMercadoPago,
  crearPreapprovalMercadoPago,
  mercadoPagoDisponible,
  obtenerPagoMercadoPago,
  obtenerPreapprovalMercadoPago,
  validarFirmaMercadoPago,
  WebhookMercadoPago,
} from '../integrations/mercadopago';
import { logger } from '../config/logger';

type RolSuscriptor = Exclude<RolUsuario, 'admin'>;

export interface PlanDisponible {
  id: PlanSuscripcion;
  nombre: string;
  precioMensual: number;
  moneda: string;
  limitesEmpresa: {
    trabajosPublicados: number;
    perfilesVisibles: number;
    consultasIA: number;
  };
  limitesProfesional: {
    propuestasEnviadas: number;
    consultasIA: number;
  };
}

export interface ResultadoHistorialSuscripcion {
  suscripciones: Suscripcion[];
  eventos: HistorialSuscripcion[];
}

/**
 * Servicio de suscripciones con Mercado Pago y fallback interno para plan gratuito.
 */
class SubscriptionService {
  /**
   * Lista planes comerciales disponibles.
   */
  listarPlanes(): PlanDisponible[] {
    return Object.values(PLANES_POR_ID).map((plan) => ({
      id: plan.id,
      nombre: plan.nombre,
      precioMensual: plan.precioMensual,
      moneda: env.MERCADOPAGO_CURRENCY,
      limitesEmpresa: plan.limitesEmpresa,
      limitesProfesional: plan.limitesProfesional,
    }));
  }

  /**
   * Crea una suscripción y devuelve checkout de Mercado Pago cuando corresponde.
   */
  async crearCheckout(
    usuarioId: string,
    rol: RolUsuario,
    datos: DatosSuscribirse
  ): Promise<ResultadoCheckoutSuscripcion> {
    if (rol === 'admin') {
      throw new ApiError('Los administradores no requieren suscripción comercial.', 400);
    }

    const usuario = await this.obtenerUsuario(usuarioId);
    const plan = obtenerPlanSuscripcion(datos.plan);
    const suscripcion = await this.crearSuscripcionInicial(usuarioId, rol, datos.plan);

    await subscriptionRepository.addHistory({
      suscripcionId: suscripcion.id,
      usuarioId,
      evento: 'checkout_creado',
      descripcion: `Checkout Mercado Pago creado para plan ${plan.nombre}.`,
      metadata: {
        plan: datos.plan,
        precioMensual: plan.precioMensual,
        moneda: env.MERCADOPAGO_CURRENCY,
      },
    });

    if (plan.precioMensual === 0) {
      await subscriptionRepository.update(suscripcion.id, { estado: 'activa' });

      return {
        suscripcion: await this.obtenerSuscripcionPorId(suscripcion.id),
        checkout: {
          proveedor: 'interno',
          requierePagoExterno: false,
          estado: 'no_requiere_pago',
        },
      };
    }

    if (!mercadoPagoDisponible()) {
      return {
        suscripcion,
        checkout: {
          proveedor: 'mercado_pago',
          requierePagoExterno: true,
          estado: 'configuracion_pendiente',
        },
      };
    }

    const preapproval = await crearPreapprovalMercadoPago({
      payerEmail: usuario.email,
      reason: `OfiAI - Plan ${plan.nombre}`,
      amount: plan.precioMensual,
      currency: env.MERCADOPAGO_CURRENCY,
      backUrl: datos.successUrl ?? 'https://ofiai.com/subscriptions/success',
      notificationUrl: env.MERCADOPAGO_NOTIFICATION_URL,
      usuarioId,
      suscripcionId: suscripcion.id,
      plan: datos.plan,
    });

    await subscriptionRepository.update(suscripcion.id, {
      estado: 'pendiente_pago',
      mercadoPagoPreapprovalId: preapproval.id,
    });

    return {
      suscripcion: await this.obtenerSuscripcionPorId(suscripcion.id),
      checkout: {
        proveedor: 'mercado_pago',
        id: preapproval.id,
        url: preapproval.initPoint ?? preapproval.sandboxInitPoint,
        requierePagoExterno: true,
        estado: 'creado',
      },
    };
  }

  /**
   * Obtiene la suscripción vigente del usuario.
   */
  async obtenerActual(usuarioId: string): Promise<Suscripcion | null> {
    return subscriptionRepository.findCurrentByUserId(usuarioId);
  }

  /**
   * Obtiene historial de suscripciones y eventos operativos.
   */
  async obtenerHistorial(usuarioId: string): Promise<ResultadoHistorialSuscripcion> {
    const [suscripciones, eventos] = await Promise.all([
      subscriptionRepository.findHistoryByUserId(usuarioId),
      subscriptionRepository.findOperationalHistoryByUserId(usuarioId),
    ]);

    return { suscripciones, eventos };
  }

  /**
   * Cancela una suscripción respetando propietario o administrador.
   */
  async cancelarSuscripcion(
    suscripcionId: string,
    usuarioId: string,
    rol: RolUsuario,
    datos: DatosCancelarSuscripcion
  ): Promise<Suscripcion> {
    const suscripcion = await this.obtenerSuscripcionPorId(suscripcionId);
    this.validarPropietario(suscripcion, usuarioId, rol);

    if (suscripcion.mercadoPagoPreapprovalId && mercadoPagoDisponible()) {
      await cancelarPreapprovalMercadoPago(suscripcion.mercadoPagoPreapprovalId);
    }

    const estado: EstadoSuscripcion = datos.cancelarAlFinalDelPeriodo ? suscripcion.estado : 'cancelada';
    await subscriptionRepository.update(suscripcionId, {
      estado,
      renovacionAutomatica: false,
    });
    await subscriptionRepository.addHistory({
      suscripcionId,
      usuarioId: suscripcion.usuarioId,
      evento: 'suscripcion_cancelada',
      descripcion: datos.motivo ?? 'Cancelación solicitada por el usuario.',
      metadata: {
        cancelarAlFinalDelPeriodo: datos.cancelarAlFinalDelPeriodo,
        proveedor: 'mercado_pago',
      },
    });

    return this.obtenerSuscripcionPorId(suscripcionId);
  }

  /**
   * Renueva manualmente una suscripción extendiendo el vencimiento un mes.
   */
  async renovarSuscripcion(suscripcionId: string, usuarioId: string, rol: RolUsuario): Promise<Suscripcion> {
    const suscripcion = await this.obtenerSuscripcionPorId(suscripcionId);
    this.validarPropietario(suscripcion, usuarioId, rol);
    const fechaBase = suscripcion.fechaVencimiento > new Date() ? suscripcion.fechaVencimiento : new Date();
    const fechaVencimiento = new Date(fechaBase);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);

    await subscriptionRepository.update(suscripcionId, {
      estado: 'activa',
      fechaVencimiento,
      renovacionAutomatica: true,
    });
    await subscriptionRepository.addHistory({
      suscripcionId,
      usuarioId: suscripcion.usuarioId,
      evento: 'suscripcion_renovada',
      descripcion: 'Suscripción renovada correctamente.',
      metadata: { fechaVencimiento: fechaVencimiento.toISOString() },
    });

    return this.obtenerSuscripcionPorId(suscripcionId);
  }

  /**
   * Procesa webhooks de Mercado Pago y sincroniza estados internos.
   */
  async procesarWebhookMercadoPago(
    payload: WebhookMercadoPago,
    firma?: string,
    requestId?: string
  ): Promise<{ recibido: true; tipo: string }> {
    const tipo = payload.type ?? payload.action ?? 'unknown';
    const dataId = payload.data?.id ?? (payload.id ? String(payload.id) : undefined);

    if (!validarFirmaMercadoPago(firma, requestId, dataId)) {
      throw new ApiError('Firma inválida de Mercado Pago.', 401);
    }

    if (!dataId) {
      logger.warn('Webhook Mercado Pago sin data.id.');
      return { recibido: true, tipo };
    }

    if (tipo.includes('preapproval')) {
      await this.sincronizarPreapproval(dataId);
    } else if (tipo.includes('payment') || tipo.includes('authorized_payment')) {
      await this.sincronizarPago(dataId);
    } else {
      logger.info(`Webhook Mercado Pago recibido sin acción específica: ${tipo}`);
    }

    return { recibido: true, tipo };
  }

  /**
   * Crea una suscripción interna inicial con límites del plan.
   */
  private async crearSuscripcionInicial(usuarioId: string, rol: RolSuscriptor, planId: IdPlanSuscripcion): Promise<Suscripcion> {
    const fechaActual = new Date();
    const fechaVencimiento = new Date(fechaActual);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
    const plan = obtenerPlanSuscripcion(planId);
    const limitesActuales = rol === 'empresa'
      ? {
        trabajosPublicados: plan.limitesEmpresa.trabajosPublicados,
        consultasIA: plan.limitesEmpresa.consultasIA,
        perfilesVisibles: plan.limitesEmpresa.perfilesVisibles,
      }
      : {
        propuestasEnviadas: plan.limitesProfesional.propuestasEnviadas,
        consultasIA: plan.limitesProfesional.consultasIA,
        perfilesVisibles: plan.limitesEmpresa.perfilesVisibles,
      };

    const suscripcion: Suscripcion = {
      id: firestore.collection(COLECCIONES.SUSCRIPCIONES).doc().id,
      usuarioId,
      rolUsuario: rol,
      plan: plan.id,
      estado: plan.precioMensual === 0 ? 'activa' : 'pendiente_pago',
      precioMensual: plan.precioMensual,
      moneda: env.MERCADOPAGO_CURRENCY,
      fechaInicio: fechaActual,
      fechaVencimiento,
      renovacionAutomatica: plan.precioMensual > 0,
      limitesActuales,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    return subscriptionRepository.create(suscripcion);
  }

  /**
   * Obtiene una suscripción o lanza 404.
   */
  private async obtenerSuscripcionPorId(id: string): Promise<Suscripcion> {
    const suscripcion = await subscriptionRepository.findById(id);

    if (!suscripcion) {
      throw new ApiError('Suscripción no encontrada.', 404);
    }

    return suscripcion;
  }

  /**
   * Obtiene un usuario para checkout.
   */
  private async obtenerUsuario(usuarioId: string): Promise<Usuario> {
    const usuario = await userRepository.findById(usuarioId);

    if (!usuario) {
      throw new ApiError('Usuario no encontrado para crear suscripción.', 404);
    }

    return usuario;
  }

  /**
   * Valida permisos sobre una suscripción.
   */
  private validarPropietario(suscripcion: Suscripcion, usuarioId: string, rol: RolUsuario): void {
    if (rol !== 'admin' && suscripcion.usuarioId !== usuarioId) {
      throw new ApiError('No tienes autorización para gestionar esta suscripción.', 403);
    }
  }

  /**
   * Sincroniza una preaprobación de Mercado Pago.
   */
  private async sincronizarPreapproval(preapprovalId: string): Promise<void> {
    const preapproval = await obtenerPreapprovalMercadoPago(preapprovalId);
    const suscripcion = await this.obtenerSuscripcionDesdeReferencia(preapproval.external_reference, preapproval.id);

    if (!suscripcion) {
      logger.warn(`Preapproval Mercado Pago sin suscripción local: ${preapprovalId}`);
      return;
    }

    if (preapproval.status === 'authorized') {
      await subscriptionRepository.update(suscripcion.id, {
        estado: 'activa',
        mercadoPagoPreapprovalId: preapproval.id,
        renovacionAutomatica: true,
      });
      await this.registrarEventoProveedor(suscripcion, 'mercado_pago_autorizada', 'Mercado Pago autorizó la suscripción.', preapproval.id);
      return;
    }

    if (['cancelled', 'paused'].includes(preapproval.status)) {
      await subscriptionRepository.update(suscripcion.id, {
        estado: 'cancelada',
        mercadoPagoPreapprovalId: preapproval.id,
        renovacionAutomatica: false,
      });
      await this.registrarEventoProveedor(suscripcion, 'mercado_pago_cancelada', 'Mercado Pago informó la cancelación o pausa.', preapproval.id);
    }
  }

  /**
   * Sincroniza un pago aprobado de Mercado Pago.
   */
  private async sincronizarPago(paymentId: string): Promise<void> {
    const pago = await obtenerPagoMercadoPago(paymentId);
    const suscripcionId = pago.external_reference ?? pago.metadata?.suscripcion_id ?? pago.metadata?.suscripcionId;

    if (!suscripcionId || pago.status !== 'approved') {
      return;
    }

    const suscripcion = await subscriptionRepository.findById(suscripcionId);

    if (!suscripcion) {
      logger.warn(`Pago Mercado Pago aprobado sin suscripción local: ${paymentId}`);
      return;
    }

    await subscriptionRepository.update(suscripcion.id, {
      estado: 'activa',
      mercadoPagoPaymentId: String(pago.id),
    });
    await this.renovarSuscripcion(suscripcion.id, suscripcion.usuarioId, 'admin');
    await this.registrarEventoProveedor(suscripcion, 'mercado_pago_pago_aprobado', 'Mercado Pago confirmó un pago aprobado.', String(pago.id));
  }

  /**
   * Busca una suscripción usando referencia interna o preapproval ID.
   */
  private async obtenerSuscripcionDesdeReferencia(
    suscripcionId: string | undefined,
    preapprovalId: string
  ): Promise<Suscripcion | null> {
    if (suscripcionId) {
      const porReferencia = await subscriptionRepository.findById(suscripcionId);
      if (porReferencia) {
        return porReferencia;
      }
    }

    return subscriptionRepository.findByMercadoPagoPreapprovalId(preapprovalId);
  }

  /**
   * Registra evento proveniente de Mercado Pago.
   */
  private async registrarEventoProveedor(
    suscripcion: Suscripcion,
    evento: string,
    descripcion: string,
    proveedorId: string
  ): Promise<void> {
    await subscriptionRepository.addHistory({
      suscripcionId: suscripcion.id,
      usuarioId: suscripcion.usuarioId,
      evento,
      descripcion,
      metadata: {
        proveedor: 'mercado_pago',
        proveedorId,
      },
    });
  }
}

export const subscriptionService = new SubscriptionService();
