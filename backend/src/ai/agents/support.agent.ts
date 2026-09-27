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
import { z } from 'zod';
import { businessAi } from '../tools/business-ai.tool';
import { SUPPORT_PROMPT,BUSINESS_PROMPT_VERSION } from '../prompts/business.prompts';
import type { AgentActor } from '../../models/agent.model';
import type { KnowledgeHit } from '../../../../shared/knowledge';

export interface RespuestaChatSoporte {
  proveedor: 'reglas';
  respuesta: string;
  accionesSugeridas: string[];
}

/**
 * Agente de chat operativo con respuestas determinísticas.
 */
class SupportAgent {
  /** Seleccion semantica de evidencia; el texto final se cita literalmente desde fuentes aprobadas. */
  async selectKnowledge(actor: AgentActor,question: string,hits: KnowledgeHit[],context: string): Promise<KnowledgeHit[]> {
    if(!hits.length) return hits;
    const schema=z.object({ids: z.array(z.string()).min(1).max(3)}).strict();
    const result=await businessAi({actor,agent: 'support',promptVersion: BUSINESS_PROMPT_VERSION,system: SUPPORT_PROMPT,
      data: {question,context: context.slice(-3000),documents: hits},schema,
      fallback: {ids: hits.slice(0,3).map(hit=>hit.documentId)},
      validate: data=>new Set(data.ids).size===data.ids.length && data.ids.every(id=>hits.some(hit=>hit.documentId===id)),
      jsonSchema: {type: 'object',properties: {ids: {type: 'array',items: {type: 'string'}}},required: ['ids'],additionalProperties: false}});
    return result.value.ids.map(id=>hits.find(hit=>hit.documentId===id)!);
  }
  /** Presenta exclusivamente campos proyectados por herramientas autorizadas. */
  explainFacts(tool: string, facts: unknown): string {
    const data = facts as Record<string, unknown>;
    if (tool === 'getJob') return 'Trabajo: ' + data.title + '. Estado: ' + data.status
      + '. Coordinacion: ' + (data.coordinationState ?? 'sin iniciar') + '. Fecha solicitada: ' + (data.preferredDate ?? 'no registrada') + '.';
    if (tool === 'getSubscription') return 'Plan: ' + data.plan + '. Estado: ' + data.status
      + '. Renovacion automatica: ' + (data.autoRenew ? 'activa' : 'desactivada') + '. Fin del periodo: ' + data.periodEnd + '.';
    if (tool === 'getInvoice') return 'Recibo de pago ' + data.id + ': ' + data.currency + ' ' + (Number(data.amountMinor) / 100)
      + '. Estado: ' + data.status + '. No es una factura fiscal.';
    return 'Profesional: ' + data.name + '. Ciudad: ' + data.city + '. Disponible: ' + (data.available ? 'si' : 'no')
      + '. Verificacion: ' + (data.verified ? 'verificado' : 'sin verificar') + '.';
  }
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
