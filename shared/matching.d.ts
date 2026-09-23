/**
 * @archivo matching.d.ts
 * @descripcion Contratos publicos del matching, sin identidad privada ni coordenadas exactas.
 */
export type MatchingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'fallback';
/** Perfil visible exclusivamente con campos profesionales publicos. */
export interface MatchProfessional {
  id: string; firstName: string; lastName: string; profileImage: string | null;
  description: string | null; categories: string[]; skills: string[];
  experienceYears: number | null; location: { country: string | null; province: string | null; city: string | null };
  available: boolean | null; availabilityDays: string[]; minimumPrice: number | null;
  hourlyRate: number | null; currency: string | null; verified: boolean;
  rating: number | null; completedJobs: number | null; responseRate: number | null;
}
/** Recomendacion trazable y seleccion previa, nunca contratacion definitiva. */
export interface ProfessionalMatch {
  professionalId: string; professional: MatchProfessional; matchScore: number; deterministicScore: number;
  semanticScore: number | null; distanceKm: number | null; reason: string;
  strengths: string[]; concerns: string[]; recommended: boolean;
  state: 'recommended' | 'selected'; generatedAt: string;
}
/** Resumen del Job usado por las dos interfaces. */
export interface MatchingJob {
  id: string; title: string; description: string; category: string;
  location: { country: string | null; province: string | null; city: string | null };
  urgency: string | null; preferredDate: string | null; budget: { min: number | null; max: number | null; currency: string | null };
  requirements: string[]; estimatedScope: string | null; workType: string; status: string;
}
/** Resultado de una corrida y progreso real de servidor. */
export interface MatchingResult {
  jobId: string; job: MatchingJob; runId: string | null; status: MatchingStatus;
  completedStages: number; totalCandidates: number; scannedCandidates: number; searchLimited: boolean;
  matches: ProfessionalMatch[]; generatedAt: string | null; expiresAt: string | null;
  semanticMatchingUsed: boolean; fallbackUsed: boolean; cached: boolean;
  selectedProfessionalId: string | null; message: string;
}
/** Handoff inerte para Pricing y Coordinator; no autoriza contacto ni cobro. */
export interface MatchingSelection {
  status: 'selected'; professionalId: string; runId: string; jobFingerprint: string; selectedAt: string;
}

