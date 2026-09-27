/** @archivo marketing.d.ts @descripcion Campanas, evidencia declarada y contenido versionado. */
export type MarketingChannel = 'in_app' | 'email' | 'social' | 'landing' | 'seo';
export interface MarketingCampaign {
  id: string; name: string; objective: 'activacion' | 'retencion' | 'recuperacion';
  audience: 'empresa' | 'profesional'; channel: MarketingChannel; stages: string[];
  status: 'draft' | 'approved' | 'paused' | 'completed'; currency: string; version: number;
  variants: Array<{ id: string; title: string; body: string; cta: string }>;
  hypothesis: string; createdAt: string; updatedAt: string; approvedBy: string | null;
  cursor: string | null; delivered: number; createdBy: string;
}
export interface MarketingReport {
  id: string; campaignId: string; variantId: string; source: string; period: string; currency: string;
  impressions: number; clicks: number; conversions: number; acquiredCustomers: number;
  spendMinor: number; attributedRevenueMinor: number; activeAtStart: number; retained: number; churned: number;
  metrics: { ctr: number | null; conversion: number | null; cacMinor: number | null; retention: number | null;
    churn: number | null; roas: number | null; roi: null; ltv: null };
  evidence: 'admin_reported'; createdAt: string;
}
