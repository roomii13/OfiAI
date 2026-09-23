/**
 * @archivo marketing.agent.ts
 * @descripcion Agente de automatización de campañas de marketing para OfiAI.
 * Genera mensajes breves para activación, retención y recuperación de usuarios.
 * @modulo AI Agents
 */

export type TipoCampañaMarketing = 'activacion' | 'retencion' | 'recuperacion';

export interface EntradaCampañaMarketing {
  tipo: TipoCampañaMarketing;
  segmento: string;
  nombreProducto?: string;
}

export interface MensajeCampañaMarketing {
  asunto: string;
  cuerpo: string;
  llamadoAccion: string;
}

/**
 * Agente de marketing con plantillas dinámicas por segmento.
 */
class MarketingAgent {
  /**
   * Genera un mensaje listo para campañas de email o notificación interna.
   */
  generarMensaje(entrada: EntradaCampañaMarketing): MensajeCampañaMarketing {
    const producto = entrada.nombreProducto ?? 'OfiAI';

    if (entrada.tipo === 'activacion') {
      return {
        asunto: `Empieza a usar ${producto} con mejores coincidencias`,
        cuerpo: `Hola, ${entrada.segmento}: publica una solicitud clara y deja que el ranking inicial priorice profesionales por oficio, ubicación y reputación.`,
        llamadoAccion: 'Publicar solicitud',
      };
    }

    if (entrada.tipo === 'retencion') {
      return {
        asunto: `Nuevas oportunidades para ${entrada.segmento}`,
        cuerpo: `Revisa tu panel de ${producto}: hay métricas, recomendaciones y actividad reciente para tomar mejores decisiones.`,
        llamadoAccion: 'Ver dashboard',
      };
    }

    return {
      asunto: `Vuelve a encontrar profesionales confiables en ${producto}`,
      cuerpo: `Tu cuenta puede seguir usando clasificación, recomendaciones y estimaciones para resolver trabajos más rápido.`,
      llamadoAccion: 'Volver a OfiAI',
    };
  }
}

export const marketingAgent = new MarketingAgent();
