/**
 * @archivo collections.ts
 * @descripcion Nombres de colecciones de Firestore para OfiAI.
 * Fuente única de verdad para todos los nombres de colecciones.
 * Evita errores de tipografía y facilita renombrar colecciones.
 */
export const COLECCIONES = {
  USUARIOS: 'users',
  SALES_LEADS: 'sales_leads',
  MARKETING_CAMPAIGNS: 'marketing_campaigns',
  SUPPORT_SESSIONS: 'support_sessions',
  SUPPORT_TICKETS: 'support_tickets',
  AGENT_RUNS: 'agent_runs',
  AGENT_EVENTS: 'agent_events',
  AI_KNOWLEDGE: 'ai_knowledge',
  AGENT_AUDIT: 'agent_audit',
  AI_BUDGETS: 'ai_budgets',
  AI_OBSERVATIONS: 'ai_observations',
  EMPRESAS: 'companies',
  PROFESIONALES: 'professionals',
  TRABAJOS: 'jobs',
  AI_INTAKE_SESSIONS: 'ai_intake_sessions',
  MATCHES: 'matches',
  MATCHING: 'matching',
  PRICING: 'pricing',
  PRICING_QUOTES: 'pricing_quotes',
  PRICING_ESTIMATES: 'pricing_estimates',
  PRICING_AUDIT: 'pricing_audit',
  COORDINATOR: 'coordinator',
  COORDINATOR_HISTORY: 'coordinator_history',
  COORDINATOR_COMMANDS: 'coordinator_commands',
  COORDINATOR_OFFERS: 'coordinator_offers',
  COORDINATION_WORKFLOWS: 'coordination_workflows',
  COORDINATOR_OUTBOX: 'coordinator_outbox',
  PROPUESTAS: 'proposals',
  RESENAS: 'reviews',
  SUSCRIPCIONES: 'subscriptions',
  HISTORIAL_SUSCRIPCIONES: 'subscription_history',
  BILLING_ACCOUNTS: 'billing_accounts',
  BILLING_PAYMENTS: 'billing_payments',
  BILLING_REVENUE: 'billing_revenue',
  BILLING_USAGE: 'billing_usage',
  BILLING_TASKS: 'billing_tasks',
  NOTIFICACIONES: 'notifications',
  ANALYTICS_EVENTOS: 'analytics_events',
  ANALYTICS_REPORTES: 'analytics_reports',
} as const;

export type NombreColeccion = typeof COLECCIONES[keyof typeof COLECCIONES];
