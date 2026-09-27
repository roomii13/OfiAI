/**
 * @archivo marketing.agent.ts
 * @descripcion Agente de automatización de campañas de marketing para OfiAI.
 * Genera mensajes breves para activación, retención y recuperación de usuarios.
 * @modulo AI Agents
 */

export type TipoCampañaMarketing = 'activacion' | 'retencion' | 'recuperacion';
import { z } from 'zod';
import { businessAi } from '../tools/business-ai.tool';
import { MARKETING_PROMPT,BUSINESS_PROMPT_VERSION } from '../prompts/business.prompts';
import type { AgentActor } from '../../models/agent.model';

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
  /** Produce un borrador estructurado; la aprobacion humana sigue siendo obligatoria. */
  async draft(actor: AgentActor,base: MensajeCampañaMarketing): Promise<MensajeCampañaMarketing> {
    const schema=z.object({asunto: z.string().min(3).max(120),cuerpo: z.string().min(10).max(1500),llamadoAccion: z.string().min(3).max(100)}).strict();
    const result=await businessAi({actor,agent: 'marketing',promptVersion: BUSINESS_PROMPT_VERSION,system: MARKETING_PROMPT,
      data: base,schema,fallback: base,validate: value=>value.llamadoAccion===base.llamadoAccion,
      jsonSchema: {type: 'object',properties: {asunto: {type: 'string'},cuerpo: {type: 'string'},llamadoAccion: {type: 'string'}},
        required: ['asunto','cuerpo','llamadoAccion'],additionalProperties: false}});
    return result.value;
  }
  /** Calcula tasas solo con denominadores observados; ROI necesita beneficios y LTV cohortes. */
  metrics(data: { impressions: number; clicks: number; conversions: number; acquiredCustomers: number;
    spendMinor: number; attributedRevenueMinor: number; activeAtStart: number; retained: number; churned: number }) {
    return { ctr: data.impressions ? data.clicks / data.impressions : null,
      conversion: data.clicks ? data.conversions / data.clicks : null,
      cacMinor: data.acquiredCustomers ? data.spendMinor / data.acquiredCustomers : null,
      retention: data.activeAtStart ? data.retained / data.activeAtStart : null,
      churn: data.activeAtStart ? data.churned / data.activeAtStart : null,
      roas: data.spendMinor ? data.attributedRevenueMinor / data.spendMinor : null,
      roi: null, ltv: null };
  }
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
