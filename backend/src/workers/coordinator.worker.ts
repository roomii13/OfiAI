/** @archivo coordinator.worker.ts @descripcion Recuperacion de entregas internas, independiente de pagos y proveedores externos. */
import { coordinatorRepository } from '../repositories/coordinator.repository';
import { logger } from '../config/logger';
/** Entrega pendiente idempotente; un fallo conserva CONTACT_PENDING para reintentar. */
export async function coordinatorWorker(jobId: string): Promise<boolean> {
  try { return await coordinatorRepository.deliver(jobId); }
  catch { logger.warn('Invitacion interna pendiente de reintento.', { jobId }); return false; }
}
/** Procesa un lote acotado mediante el scheduler existente. */
export async function coordinatorRetriesWorker(): Promise<number> {
  const ids = await coordinatorRepository.pending(); let delivered = 0;
  for (const id of ids) if (await coordinatorWorker(id)) delivered += 1;
  return delivered;
}
