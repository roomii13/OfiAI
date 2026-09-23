/**
 * @archivo templates.ts
 * @descripcion Plantillas reutilizables de notificaciones para email, WhatsApp, push e internas en OfiAI.
 * Centraliza asuntos, mensajes y HTML transaccional por tipo de evento.
 * @modulo Notifications
 */

import { TipoNotificacion } from '../models/Notification';

export interface DatosPlantillaNotificacion {
  nombre?: string;
  tituloTrabajo?: string;
  nombreEmpresa?: string;
  nombreProfesional?: string;
  accionUrl?: string;
  detalle?: string;
}

export interface PlantillaNotificacion {
  titulo: string;
  mensaje: string;
  html: string;
}

/**
 * Renderiza una plantilla de notificación según el tipo de evento.
 */
export const renderizarPlantillaNotificacion = (
  tipo: TipoNotificacion,
  datos: DatosPlantillaNotificacion = {}
): PlantillaNotificacion => {
  const nombre = datos.nombre ?? 'Hola';
  const tituloTrabajo = datos.tituloTrabajo ?? 'tu solicitud';
  const detalle = datos.detalle ?? 'Ingresa a OfiAI para revisar los detalles.';

  const plantillas: Record<TipoNotificacion, Omit<PlantillaNotificacion, 'html'>> = {
    nueva_propuesta: {
      titulo: 'Nueva propuesta recibida',
      mensaje: `${nombre}, recibiste una nueva propuesta para ${tituloTrabajo}.`,
    },
    propuesta_aceptada: {
      titulo: 'Propuesta aceptada',
      mensaje: `${nombre}, tu propuesta fue aceptada. Coordina los próximos pasos desde OfiAI.`,
    },
    propuesta_rechazada: {
      titulo: 'Propuesta no seleccionada',
      mensaje: `${nombre}, esta vez eligieron otra propuesta. Sigue postulando a nuevos trabajos.`,
    },
    trabajo_publicado: {
      titulo: 'Trabajo publicado',
      mensaje: `${nombre}, ${tituloTrabajo} ya está publicado y listo para recibir propuestas.`,
    },
    trabajo_completado: {
      titulo: 'Trabajo completado',
      mensaje: `${nombre}, marcamos ${tituloTrabajo} como completado.`,
    },
    nueva_resena: {
      titulo: 'Nueva reseña recibida',
      mensaje: `${nombre}, recibiste una nueva reseña en tu perfil profesional.`,
    },
    suscripcion_vencida: {
      titulo: 'Suscripción vencida',
      mensaje: `${nombre}, tu suscripción venció. Renueva para mantener tus beneficios activos.`,
    },
    recomendacion_ia: {
      titulo: 'Recomendación IA disponible',
      mensaje: `${nombre}, OfiAI generó nuevas recomendaciones para ${tituloTrabajo}.`,
    },
    alerta_sistema: {
      titulo: 'Alerta del sistema',
      mensaje: `${nombre}, ${detalle}`,
    },
  };

  const plantilla = plantillas[tipo];

  return {
    ...plantilla,
    html: crearHtmlEmail(plantilla.titulo, plantilla.mensaje, datos.accionUrl),
  };
};

/**
 * Crea HTML transaccional simple y consistente para email.
 */
const crearHtmlEmail = (titulo: string, mensaje: string, accionUrl?: string): string => {
  const boton = accionUrl
    ? `<p><a href="${accionUrl}" style="background:#111827;color:#ffffff;padding:12px 16px;text-decoration:none;border-radius:6px;">Abrir OfiAI</a></p>`
    : '';

  return [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">',
    `<h1 style="font-size:20px;">${titulo}</h1>`,
    `<p>${mensaje}</p>`,
    boton,
    '<p style="font-size:12px;color:#6b7280;">OfiAI - Gestión inteligente de oficios.</p>',
    '</div>',
  ].join('');
};
