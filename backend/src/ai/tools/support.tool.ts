/** @archivo support.tool.ts @descripcion Allowlist de herramientas de lectura; ninguna consulta arbitraria. */
import { agentDataRepository } from '../../repositories/agent-data.repository';
import type { AgentActor } from '../../models/agent.model';
import type { SupportSession } from '../../../../shared/support';
import { ApiError } from '../../middleware/error.middleware';
import { toolAllowed } from '../../constants/agent-policy';
/** La seleccion se valida en servidor y cada herramienta vuelve a aplicar ownership. */
export async function supportTool(actor: AgentActor, resource: NonNullable<SupportSession['resource']>): Promise<unknown> {
  if(!toolAllowed('support',resource.tool,actor.rol)) throw new ApiError('Herramienta no permitida.',403);
  if (resource.tool === 'getSubscription') return agentDataRepository.getSubscription(actor);
  if (!resource.id) throw new ApiError('Indica el identificador del recurso.',400);
  if (resource.tool === 'getJob') return agentDataRepository.getJob(actor,resource.id);
  if (resource.tool === 'getInvoice') return agentDataRepository.getInvoice(actor,resource.id);
  return agentDataRepository.getProfessional(actor,resource.id);
}
