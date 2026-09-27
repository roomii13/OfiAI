/** @archivo billing-worker.test.ts @descripcion Reconciliacion paginada, exclusividad y reintentos sin cobros. */
import { firestore } from '../../src/integrations/firebase/admin';
import { MemoryFirestore } from '../intake-fixtures';
import { billingReconciliationWorker } from '../../src/workers/billing.worker';
import { subscriptionService } from '../../src/services/subscription.service';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/integrations/mercadopago', () => ({ mercadoPagoDisponible: () => true }));
jest.mock('../../src/services/subscription.service', () => ({ subscriptionService: { renovarSuscripcion: jest.fn() } }));
const db = firestore as unknown as MemoryFirestore;
beforeEach(async () => {
  db.clear(); jest.clearAllMocks();
  for (let index = 0; index < 7; index++) await db.collection('subscriptions').doc('sub-' + index).set({
    usuarioId: 'user-' + index, renovacionAutomatica: true,
  });
  jest.mocked(subscriptionService.renovarSuscripcion).mockResolvedValue({} as never);
});
it('pagina mas alla de cinco contratos y vuelve al inicio al terminar', async () => {
  expect(await billingReconciliationWorker()).toBe(5);
  expect(await billingReconciliationWorker()).toBe(2);
  expect(subscriptionService.renovarSuscripcion).toHaveBeenCalledTimes(7);
  expect(db.documents.get('billing_tasks/reconciliation')?.cursor).toBe('');
});
it('un contrato fallido no bloquea los demas y queda para la siguiente vuelta', async () => {
  jest.mocked(subscriptionService.renovarSuscripcion).mockRejectedValueOnce(new Error('timeout'));
  expect(await billingReconciliationWorker()).toBe(4);
  expect(subscriptionService.renovarSuscripcion).toHaveBeenCalledTimes(5);
});
it('dos schedulers no procesan el mismo lote al mismo tiempo', async () => {
  const result = await Promise.all([billingReconciliationWorker(), billingReconciliationWorker()]);
  expect(result.sort()).toEqual([0, 5]);
});
