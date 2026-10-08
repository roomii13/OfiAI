/** @archivo protected-contract.ts @descripcion Confirmaciones y reclamos vinculados al workflow, sin custodia ni movimientos de fondos. */
import type { StoredProtectedContract } from '../../models/protected-contract.model';
import type { StoredCoordinator, CoordinatorCommand } from '../../models/coordinator.model';
import { ApiError } from '../../middleware/error.middleware';
/** Se ejecuta dentro de la misma transaccion que el cambio de Coordinator y Job. */
export function transitionProtectedWork(c: StoredProtectedContract, before: StoredCoordinator, next: StoredCoordinator, cmd: CoordinatorCommand): StoredProtectedContract {
  if (c.workflowId !== before.id || c.quoteId !== before.offer?.quote.id) throw new ApiError('El expediente no corresponde al acuerdo vigente.', 409);
  if (['submit_quote','counter_offer','cancel'].includes(cmd.action)) throw new ApiError('El acuerdo tiene un expediente financiero. Requiere resolucion, no modificaciones silenciosas.', 409);
  if (['start_work','request_completion','complete'].includes(cmd.action)) {
    if (c.dispute && c.dispute.state !== 'RESOLVED') throw new ApiError('Hay un reclamo abierto. Revisa el centro de resolucion.', 409);
  }
  const result: StoredProtectedContract = { ...c, workState: next.state, updatedAt: next.updatedAt, revision: c.revision + 1 };
  if (cmd.action === 'request_completion') result.professionalCompletedAt = next.updatedAt;
  if (cmd.action === 'complete') {
    if (!c.professionalCompletedAt) throw new ApiError('Falta la confirmacion del profesional.', 409);
    result.clientApprovedAt = next.updatedAt; result.workState = 'BOTH_APPROVED';
  }
  return result;
}
