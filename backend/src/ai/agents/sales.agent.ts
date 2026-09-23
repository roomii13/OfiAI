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

export interface ResultadoLeadVentas {
  puntaje: number;
  etapa: 'frio' | 'tibio' | 'caliente';
  siguienteAccion: string;
}

/**
 * Agente comercial con scoring simple de intención.
 */
class SalesAgent {
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
}

export const salesAgent = new SalesAgent();
