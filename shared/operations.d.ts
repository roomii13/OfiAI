/** @archivo operations.d.ts @descripcion Proyecciones administrativas sin secretos ni escrituras financieras. */
export type OperationsResource='users'|'companies'|'professionals'|'jobs'|'subscriptions'|'transactions'|'matches';
export interface OperationsRow {id:string;fields:Record<string,string|number|boolean|null>;}
export interface OperationsList {resource:OperationsResource;rows:OperationsRow[];nextCursor:string|null;}
export interface CommandCenter {
  snapshot:import('./intelligence').IntelligenceSnapshot;
  funnel:{leads:number;customers:number;conversion:number|null;definition:string};
  operations:{openTickets:number;flaggedJobs:number};
  ai:{observations:number;success:number;fallback:number;failure:number;knownEstimatedCostUsd:number|null;unknownCostCalls:number;automationRate:number|null};
  generatedAt:string;limitations:string[];
}
