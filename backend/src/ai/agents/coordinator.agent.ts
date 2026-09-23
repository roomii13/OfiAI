/**
 * @archivo coordinator.agent.ts
 * @descripcion Agente coordinador de flujos IA para OfiAI.
 * Define pasos recomendados entre clasificación, pricing y matching.
 * @modulo AI Agents
 */

export interface PlanAgenteIA {
  objetivo: string;
  pasos: string[];
  requiereGemini: boolean;
}

/**
 * Agente que describe flujos de trabajo IA reutilizables.
 */
class CoordinatorAgent {
  /**
   * Construye un plan de ejecución IA según el objetivo solicitado.
   */
  crearPlan(objetivo: 'publicar_trabajo' | 'contratar_profesional' | 'soporte'): PlanAgenteIA {
    if (objetivo === 'publicar_trabajo') {
      return {
        objetivo,
        pasos: ['Clasificar solicitud', 'Estimar precio', 'Sugerir habilidades', 'Publicar trabajo'],
        requiereGemini: false,
      };
    }

    if (objetivo === 'contratar_profesional') {
      return {
        objetivo,
        pasos: ['Cargar trabajo', 'Rankear profesionales', 'Revisar alertas', 'Contactar candidatos'],
        requiereGemini: false,
      };
    }

    return {
      objetivo,
      pasos: ['Entender consulta', 'Responder con reglas', 'Escalar a Gemini si está configurado'],
      requiereGemini: false,
    };
  }
}

export const coordinatorAgent = new CoordinatorAgent();
