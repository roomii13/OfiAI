/**
 * @archivo support.agent.ts
 * @descripcion Agente de soporte conversacional para usuarios de OfiAI.
 * Entrega respuestas iniciales por reglas y puede ser reemplazado por Gemini sin cambiar controladores.
 * @modulo AI Agents
 */

export interface EntradaChatSoporte {
  mensaje: string;
  rolUsuario: string;
  contexto?: string;
}

export interface RespuestaChatSoporte {
  proveedor: 'reglas';
  respuesta: string;
  accionesSugeridas: string[];
}

/**
 * Agente de chat operativo con respuestas determinísticas.
 */
class SupportAgent {
  /**
   * Responde una consulta frecuente usando reglas del dominio OfiAI.
   */
  responder(entrada: EntradaChatSoporte): RespuestaChatSoporte {
    const mensaje = entrada.mensaje.toLowerCase();

    if (mensaje.includes('precio') || mensaje.includes('presupuesto') || mensaje.includes('cotizar')) {
      return {
        proveedor: 'reglas',
        respuesta: 'Para estimar un precio necesito categoría, ciudad, urgencia y nivel de detalle del trabajo. Con esos datos puedo sugerir un rango y marcar si conviene visita técnica.',
        accionesSugeridas: ['Clasificar solicitud', 'Estimar precio', 'Solicitar fotos o medidas'],
      };
    }

    if (mensaje.includes('profesional') || mensaje.includes('recomendar') || mensaje.includes('matching')) {
      return {
        proveedor: 'reglas',
        respuesta: 'El matching prioriza coincidencia de oficio, habilidades, ubicación, disponibilidad, reputación y experiencia. Los perfiles verificados y con buenas reseñas suben en el ranking.',
        accionesSugeridas: ['Ejecutar matching', 'Revisar alertas del ranking', 'Contactar candidatos mejor puntuados'],
      };
    }

    if (mensaje.includes('suscripcion') || mensaje.includes('plan') || mensaje.includes('pago')) {
      return {
        proveedor: 'reglas',
        respuesta: 'OfiAI soporta plan gratuito, profesional y empresa. La suscripción controla límites de publicaciones, propuestas, consultas IA y visibilidad de perfiles.',
        accionesSugeridas: ['Ver planes', 'Abrir checkout', 'Revisar historial de pagos'],
      };
    }

    return {
      proveedor: 'reglas',
      respuesta: 'Puedo ayudarte a clasificar una solicitud, recomendar profesionales, estimar precios o revisar métricas operativas. Describe el caso y te doy el siguiente paso más útil.',
      accionesSugeridas: ['Clasificar solicitud', 'Recomendar profesionales', 'Estimar precio'],
    };
  }
}

export const supportAgent = new SupportAgent();
