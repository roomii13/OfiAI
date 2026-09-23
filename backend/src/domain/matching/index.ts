/**
 * @archivo domain/matching/index.ts
 * @dominio Matching
 * @descripcion Dominio de matching en OfiAI.
 */
export type {
  ComponentesRanking,
  NivelCompatibilidad,
  ResultadoRankingProfesional,
} from '../../ai/tools/ranking.tool';
export { rankingTool } from '../../ai/tools/ranking.tool';
export type { MatchingResult, ProfessionalMatch, MatchingSelection } from '../../../../shared/matching';
export { publicMatchingJob, publicMatchProfessional } from './matching';
