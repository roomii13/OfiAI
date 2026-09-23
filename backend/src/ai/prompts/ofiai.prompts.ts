/**
 * @archivo ofiai.prompts.ts
 * @descripcion Prompts estructurados para agentes IA de OfiAI.
 * Mantiene instrucciones centralizadas y listas para usar con Gemini cuando esté habilitado.
 * @modulo AI Prompts
 */

import { Trabajo } from '../../models/Job';
import { ResultadoRankingProfesional } from '../tools/ranking.tool';

export interface PromptChatContexto {
  rolUsuario: string;
  nombreUsuario?: string;
  contexto?: string;
}

export const PROMPT_SISTEMA_OFIAI = [
  'Eres OfiAI, asistente operativo para contratar profesionales de oficios en LATAM.',
  'Responde en español latino, con claridad, acciones concretas y sin inventar datos.',
  'Prioriza seguridad, verificación, presupuesto claro y próximos pasos prácticos.',
].join('\n');

/**
 * Crea un prompt para que Gemini explique o mejore un ranking calculado por reglas.
 */
export const crearPromptRankingGemini = (
  trabajo: Trabajo,
  ranking: ResultadoRankingProfesional[]
): string => {
  const candidatos = ranking.map((resultado, indice) => ({
    posicion: indice + 1,
    profesionalId: resultado.profesional.id,
    puntajeReglas: resultado.puntaje,
    razones: resultado.razones,
    alertas: resultado.alertas,
  }));

  return [
    PROMPT_SISTEMA_OFIAI,
    'Analiza el siguiente ranking calculado por reglas y devuelve recomendaciones breves para la empresa.',
    'No cambies IDs ni inventes profesionales. Señala riesgos de contratación si aparecen.',
    `Trabajo: ${JSON.stringify({
      id: trabajo.id,
      titulo: trabajo.titulo,
      categoria: trabajo.categoria,
      subcategoria: trabajo.subcategoria,
      habilidadesRequeridas: trabajo.habilidadesRequeridas,
      ciudad: trabajo.ciudad,
      tipoTrabajo: trabajo.tipoTrabajo,
    })}`,
    `Ranking: ${JSON.stringify(candidatos)}`,
  ].join('\n\n');
};

/**
 * Crea un prompt para conversación de soporte y asesoría dentro de OfiAI.
 */
export const crearPromptChatSoporte = (mensaje: string, contexto: PromptChatContexto): string => {
  return [
    PROMPT_SISTEMA_OFIAI,
    `Rol del usuario: ${contexto.rolUsuario}`,
    contexto.nombreUsuario ? `Nombre del usuario: ${contexto.nombreUsuario}` : '',
    contexto.contexto ? `Contexto adicional: ${contexto.contexto}` : '',
    `Mensaje del usuario: ${mensaje}`,
    'Responde con una recomendación directa y accionable.',
  ].filter(Boolean).join('\n');
};

/**
 * Crea un prompt para clasificación semántica futura de solicitudes.
 */
export const crearPromptClasificacionSolicitud = (titulo: string | undefined, descripcion: string): string => {
  return [
    PROMPT_SISTEMA_OFIAI,
    'Clasifica la solicitud en categoría, subcategoría, prioridad, complejidad y habilidades detectadas.',
    'Devuelve JSON válido y no agregues texto fuera del JSON.',
    `Título: ${titulo ?? ''}`,
    `Descripción: ${descripcion}`,
  ].join('\n');
};
