/**
 * @archivo sales.agent.ts
 * @descripcion Agente de asistencia comercial y conversión de leads para OfiAI.
 * Prioriza leads por intención, rol y señales de necesidad operativa.
 * @modulo AI Agents
 */

export interface EntradaLeadVentas {
  rol: 'empresa' | 'profesional';
  mensaje: string;
  cantidadTrabajos?: number;
}

import { z } from 'zod';
import { businessAi } from '../tools/business-ai.tool';
import { SALES_PROMPT, BUSINESS_PROMPT_VERSION } from '../prompts/business.prompts';
import type { AgentActor } from '../../models/agent.model';

export interface ResultadoLeadVentas {
  puntaje: number;
  etapa: 'frio' | 'tibio' | 'caliente';
  siguienteAccion: string;
}

/**
 * Agente comercial con scoring simple de intención.
 */
export class SalesAgent {
  /** Comprension semantica opcional con citas literales; no cambia precios ni concede acceso. */
  async enrich(actor: AgentActor,lead: import('../../models/sales.model').SalesLead) {
    const schema=z.object({intent: z.enum(['exploring','activation','purchase']),evidence: z.array(z.string().min(3).max(160)).max(3)}).strict();
    const output=await businessAi({actor,agent: 'sales',promptVersion: BUSINESS_PROMPT_VERSION,system: SALES_PROMPT,
      data: {need: lead.need,audience: lead.audience},schema,
      jsonSchema: {type: 'object',properties: {intent: {type: 'string',enum: ['exploring','activation','purchase']},
        evidence: {type: 'array',items: {type: 'string'},maxItems: 3}},required: ['intent','evidence'],additionalProperties: false},
      fallback: {intent: lead.assessment.intent,evidence: []},
      validate: result=>result.evidence.length>0 && result.evidence.every(quote=>lead.need.includes(quote))});
    return {...lead.assessment,intent: output.value.intent,
      reasons: [...lead.assessment.reasons,...output.value.evidence.map(quote=>'Intencion declarada: '+quote)]};
  }
  /**
   * Evalúa un lead y sugiere la siguiente acción comercial.
   */
  calificarLead(entrada: EntradaLeadVentas): ResultadoLeadVentas {
    const mensaje = entrada.mensaje.toLowerCase();
    let puntaje = entrada.rol === 'empresa' ? 35 : 25;

    if (mensaje.includes('precio') || mensaje.includes('plan') || mensaje.includes('demo')) {
      puntaje += 25;
    }
    if (mensaje.includes('urgente') || mensaje.includes('contratar') || mensaje.includes('publicar')) {
      puntaje += 25;
    }
    if ((entrada.cantidadTrabajos ?? 0) >= 3) {
      puntaje += 15;
    }

    const puntajeFinal = Math.min(puntaje, 100);

    return {
      puntaje: puntajeFinal,
      etapa: this.obtenerEtapa(puntajeFinal),
      siguienteAccion: puntajeFinal >= 70 ? 'Ofrecer checkout o demo asistida' : 'Enviar guía de activación y caso de uso',
    };
  }

  /**
   * Convierte puntaje comercial en etapa de lead.
   */
  private obtenerEtapa(puntaje: number): ResultadoLeadVentas['etapa'] {
    if (puntaje >= 70) {
      return 'caliente';
    }

    if (puntaje >= 40) {
      return 'tibio';
    }

    return 'frio';
  }
  /** Evalua evidencia real y recomienda el menor plan que cubre el volumen declarado. */
  assess(lead: import('../../models/sales.model').SalesLead,
    plans: ReadonlyArray<{ id: string; nombre: string; limits: { trabajosPublicados: number; propuestasEnviadas: number } }>)
    : import('../../models/sales.model').SalesAssessment {
    const base = this.calificarLead({ rol: lead.audience, mensaje: lead.need, cantidadTrabajos: lead.expectedMonthlyVolume });
    const text = lead.need.toLowerCase();
    const intent = /contratar|comprar|pagar|precio|suscri/.test(text) ? 'purchase' : /publicar|trabajo|propuesta/.test(text) ? 'activation' : 'exploring';
    const abandoned = Date.now() - Date.parse(lead.lastActivityAt) > 7 * 86400000 && !['CUSTOMER', 'LOST'].includes(lead.stage);
    const selected = plans.find(plan => {
      const quota = lead.audience === 'empresa' ? plan.limits.trabajosPublicados : plan.limits.propuestasEnviadas;
      return quota === -1 || quota >= lead.expectedMonthlyVolume;
    });
    return { score: base.puntaje, intent, abandoned,
      reasons: [intent === 'purchase' ? 'Expreso interes comercial.' : 'Necesidad declarada por el usuario.',
        'Volumen mensual declarado: ' + lead.expectedMonthlyVolume,
        ...(abandoned ? ['Sin interaccion registrada durante siete dias.'] : [])],
      recommendedPlan: selected?.id ?? 'gratuito',
      nextAction: abandoned ? 'Consultar si necesita ayuda para continuar.' : base.siguienteAccion };
  }

  /** No promete descuentos, pruebas gratis, contactos ni resultados inexistentes. */
  message(lead: import('../../models/sales.model').SalesLead, planName: string): string {
    return (lead.assessment.abandoned ? 'Tu consulta sigue disponible. ' : 'Gracias por contarnos lo que necesitas. ')
      + 'Por tu volumen declarado, te sugerimos revisar el plan ' + planName
      + '. Podes consultar precios y condiciones en Suscripciones. Si necesitas ayuda, responde desde Soporte. '
      + 'Podes desactivar estos recordatorios en Preferencias comerciales.';
  }
}

export const salesAgent = new SalesAgent();
