/** @archivo pricing.ts @descripcion Politica versionada sin tarifas ni conversiones inventadas. */
export const PRICING_POLICY = {
  version: '1.0.0', ttlMs: 30 * 60 * 1000, leaseMs: 60000, historyAgeDays: 90,
  maxRecords: 100, maxQuotes: 40, outlierMinSamples: 5, iqrMultiplier: 1.5,
  comparisonMinPeers: 3, lowRatio: 0.5, highRatio: 2,
  confidence: { quote: 65, history: 55, rate: 35, max: 85 },
} as const;
