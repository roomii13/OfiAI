/** @archivo settlements.d.ts @descripcion Cobros y liquidaciones manuales: no representa custodia ni transferencias automaticas. */
export interface SettlementAccount {
  holder: string; account: string; kind: 'cbu_cvu' | 'alias'; currency: 'ARS'; version: number;
  verified: boolean; updatedAt: string;
}
export interface SettlementRow {
  jobId: string; professionalId: string; professionalName: string; professionalUserId: string; clientName: string;
  currency: string; minorDigits: number; quoteMinor: number; commissionBps: number; ofiaiFeeMinor: number;
  processingEstimatedMinor: number; taxesEstimatedMinor: number; clientTotalMinor: number;
  paymentId: string | null; paymentStatus: string; collectedMinor: number | null;
  providerCostsActualMinor: number | null; netReceivedMinor: number | null;
  professionalTransferMinor: number; ofiaiNetEstimatedMinor: number; ofiaiNetActualMinor: number | null;
  shortageMinor: number | null; readyToTransfer: boolean; blockers: string[];
  account: SettlementAccount | null;
  status: 'PENDING' | 'REVIEW' | 'READY' | 'MANUALLY_RECORDED';
  transfer: null | { reference: string; recordedAt: string; amountMinor: number; account: SettlementAccount; confirmation: 'manual_record' };
}
export interface SettlementOverview { items: SettlementRow[]; limit: number; hasMore: boolean }
