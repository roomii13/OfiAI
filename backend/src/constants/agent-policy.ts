/** @archivo agent-policy.ts @descripcion Capacidades explicitas; el modelo no puede ampliar permisos. */
import type { RolUsuario } from '../models/User';
export const AGENT_POLICIES: Readonly<Record<string,{ roles: readonly RolUsuario[]; tools: readonly string[]; maxCalls: number }>> = {
  matching: { roles: ['empresa'],tools: ['getJob','executeMatching'],maxCalls: 2 },
  pricing: { roles: ['empresa'],tools: ['getJob','executePricing'],maxCalls: 2 },
  coordinator: { roles: ['empresa','profesional'],tools: ['getJob','getCoordination'],maxCalls: 2 },
  sales: { roles: ['admin'],tools: ['getLead','qualifyLead'],maxCalls: 2 },
  marketing: { roles: ['admin'],tools: ['getIntelligence','listCampaigns'],maxCalls: 2 },
  support: { roles: ['empresa','profesional','admin'],tools: ['getJob','getSubscription','getInvoice','getProfessional','searchKnowledge','createSupportTicket'],maxCalls: 4 },
  analytics: { roles: ['empresa','profesional','admin'],tools: ['getIntelligence'],maxCalls: 1 },
  reputation: { roles: ['empresa','profesional','admin'],tools: ['getProfessional'],maxCalls: 1 },
};
/** Nunca interpreta una herramienta desconocida como autorizada. */
export function toolAllowed(agent: string,tool: string,role: RolUsuario): boolean {
  const policy = AGENT_POLICIES[agent]; return Boolean(policy && policy.roles.includes(role) && policy.tools.includes(tool));
}
