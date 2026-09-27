/** @archivo intelligence.d.ts @descripcion Evidencia y respuestas analiticas sin cifras inventadas. */
export interface IntelligenceFact {
  id: string; label: string; value: number | string | null; unit: string; currency: string | null;
  source: string; note: string | null;
}
export interface IntelligenceSnapshot {
  scope: 'platform' | 'account'; generatedAt: string; month: string; partial: boolean;
  facts: IntelligenceFact[];
  categories: Array<{ name: string; jobs: number; completed: number }>;
  cities: Array<{ name: string; demand: number; supply: number | null }>;
  delayed: Array<{ jobId: string; title: string; reason: string }>;
  professionals: Array<{ id: string; completed: number }>;
}
export interface IntelligenceAnswer {
  question: string; answer: string; facts: IntelligenceFact[]; limitations: string[];
  snapshotAt: string; method: 'rules' | 'structured_ai';
}
