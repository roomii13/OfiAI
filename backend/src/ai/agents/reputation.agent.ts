/**
 * @archivo reputation.agent.ts
 * @descripcion Agente de análisis de reputación para profesionales de OfiAI.
 * Combina calificación, reseñas, trabajos y verificación en una puntuación explicable.
 * @modulo AI Agents
 */

import { Profesional } from '../../models/Professional';

export interface ResultadoReputacionIA {
  puntaje: number;
  nivel: 'excelente' | 'confiable' | 'nuevo' | 'riesgo';
  señales: string[];
}

/**
 * Agente de reputación basado en reglas transparentes.
 */
class ReputationAgent {
  /**
   * Calcula reputación inicial de un profesional.
   */
  calcularReputacion(profesional: Profesional): ResultadoReputacionIA {
    const calificacion = Math.min(Math.max(profesional.calificacionPromedio, 0), 5) * 12;
    const reseñas = Math.min(Math.max(profesional.totalResenas, 0), 30);
    const trabajos = Math.min(Math.max(profesional.totalTrabajos, 0), 40) * 0.5;
    const verificacion = profesional.verificado ? 10 : 0;
    const disponibilidad = profesional.disponible ? 5 : 0;
    const puntaje = this.redondear(Math.min(calificacion + reseñas + trabajos + verificacion + disponibilidad, 100));

    return {
      puntaje,
      nivel: this.obtenerNivel(puntaje, profesional),
      señales: this.generarSeñales(profesional),
    };
  }

  /**
   * Convierte puntaje y estado del perfil en nivel de reputación.
   */
  private obtenerNivel(puntaje: number, profesional: Profesional): ResultadoReputacionIA['nivel'] {
    if (puntaje >= 80 && profesional.verificado) {
      return 'excelente';
    }

    if (puntaje >= 60) {
      return 'confiable';
    }

    if (profesional.totalTrabajos <= 2) {
      return 'nuevo';
    }

    return 'riesgo';
  }

  /**
   * Genera señales descriptivas para auditar la reputación.
   */
  private generarSeñales(profesional: Profesional): string[] {
    const señales: string[] = [];

    if (profesional.verificado) {
      señales.push('Perfil verificado');
    }
    if (profesional.calificacionPromedio >= 4.5) {
      señales.push('Alta calificación promedio');
    }
    if (profesional.totalTrabajos >= 10) {
      señales.push('Historial de trabajos consistente');
    }
    if (!profesional.disponible) {
      señales.push('Disponibilidad pausada');
    }

    return señales.length > 0 ? señales : ['Perfil en etapa inicial de reputación'];
  }

  /**
   * Redondea el puntaje final.
   */
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}

export const reputationAgent = new ReputationAgent();
