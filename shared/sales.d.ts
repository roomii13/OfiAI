/** @archivo sales.d.ts @descripcion Contratos del CRM propio de OfiAI. */
export type SalesStage = 'LEAD' | 'QUALIFIED' | 'CONTACTED' | 'INTERESTED' | 'TRIAL' | 'CUSTOMER' | 'LOST';
export interface SalesAssessment {
  score: number; intent: 'exploring' | 'activation' | 'purchase'; reasons: string[];
  recommendedPlan: string; nextAction: string; abandoned: boolean;
}
export interface SalesLead {
  id: string; userId: string; name: string; audience: 'empresa' | 'profesional';
  companyName: string | null; city: string | null; stage: SalesStage;
  need: string; expectedMonthlyVolume: number; consent: boolean; consentUpdatedAt: string;
  assessment: SalesAssessment; followUpAt: string | null; followUps: number; lastActivityAt: string;
  createdAt: string; updatedAt: string; version: number;
}
export interface SalesInteraction {
  id: string; leadId: string; kind: 'created' | 'qualified' | 'message' | 'reply' | 'stage' | 'consent' | 'conversion';
  message: string; createdAt: string; actor: 'user' | 'admin' | 'system';
}
export interface SalesOverview {
  leads: SalesLead[]; stages: Record<SalesStage, number>; conversionRate: number | null;
  total: number; nextCursor: string | null; metricsScope: 'page';
}
export interface SalesDetail { lead: SalesLead; interactions: SalesInteraction[]; }
