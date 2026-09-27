/** @archivo SubscriptionBillingPanel.tsx @descripcion Consumo, pagos confirmados y gestion explicita del contrato. */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api/client';
import { useApiResource, metricLabel } from '../lib/api/resources';
import type { BillingOverview } from '../../../shared/billing';
import type { SubscriptionData } from '../../../shared/contracts';

/** Muestra datos financieros reales separados del catalogo comercial. */
export function SubscriptionBillingPanel({ onChanged }: { onChanged: () => void }) {
  const { role } = useAuth();
  const billing = useApiResource<BillingOverview>(role === 'admin' ? null : '/subscriptions/billing');
  const current = useApiResource<SubscriptionData | null>(role === 'admin' ? null : '/subscriptions/me');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const revenue = useApiResource<Array<{ currency: string; grossMinor: number; refundedMinor: number; netMinor: number; payments: number }>>(
    role === 'admin' ? '/subscriptions/revenue?month=' + month : null);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);

  /** Cancelar no reintegra dinero ni retira el periodo ya pagado. */
  async function manage(id: string, action: 'renew' | 'cancel'): Promise<void> {
    if (busy) return;
    if (action === 'cancel' && !window.confirm('Cancelar los proximos debitos? Conservas el periodo pagado. No se solicita un reembolso.')) return;
    setBusy(true); setMessage('');
    try {
      await api.post('/subscriptions/' + id + '/' + action, action === 'cancel' ? { cancelarAlFinalDelPeriodo: true } : {});
      setMessage(action === 'cancel' ? 'Renovacion cancelada; conservas el periodo pagado.' : 'Estado de pagos actualizado.');
      billing.reload(); current.reload(); onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la facturacion.'); }
    finally { setBusy(false); }
  }

  return <section className="mb-8 border-y border-border py-5">
    {role === 'admin' ? <>
      <h2 className="text-lg font-semibold">Ingresos confirmados</h2>
      <label className="mt-3 block text-sm">Periodo
        <input className="ofi-input mt-2 max-w-xs" type="month" value={month} onChange={event => {
          if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
        }} /></label>
      {revenue.loading && <p role="status">Cargando ingresos...</p>}
      {revenue.error && <p role="alert">{revenue.error}</p>}
      {revenue.data?.length === 0 && <p className="mt-3">Sin pagos confirmados en este periodo.</p>}
      {revenue.data?.map(item => <dl className="mt-4 grid gap-3 sm:grid-cols-4" key={item.currency}>
        <div><dt>Cobros {item.currency}</dt><dd>{(item.grossMinor / 100).toLocaleString()}</dd></div>
        <div><dt>Reintegros</dt><dd>{(item.refundedMinor / 100).toLocaleString()}</dd></div>
        <div><dt>Neto antes de gastos e impuestos</dt><dd>{(item.netMinor / 100).toLocaleString()}</dd></div>
        <div><dt>Pagos</dt><dd>{item.payments}</dd></div>
      </dl>)}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cuenta y facturacion</h2>
        <button className="ofi-btn-secondary" title="Actualizar facturacion" aria-label="Actualizar facturacion" disabled={busy}
          onClick={() => { if (current.data) void manage(current.data.id, 'renew'); else { billing.reload(); current.reload(); } }}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {billing.loading && <p role="status">Cargando facturacion...</p>}
      {billing.error && <p role="alert" className="mt-3">{billing.error}</p>}
      {current.error && <p role="alert">{current.error}</p>}
      {current.data?.fechaVencimiento && current.data.plan !== 'gratuito' && current.data.estado !== 'pendiente_pago' && <p className="mt-2 text-sm">
        Periodo hasta {new Date(current.data.fechaVencimiento).toLocaleDateString()}.</p>}
      {current.data?.pendingPlan && <p className="mt-2 text-sm">Cambio pendiente: {current.data.pendingPlan.plan},
        desde {new Date(current.data.pendingPlan.effectiveAt).toLocaleDateString()}.</p>}
      {current.data?.renovacionAutomatica && current.data.plan !== 'gratuito' && <button className="ofi-btn-secondary mt-3" disabled={busy}
        onClick={() => void manage(current.data!.id, 'cancel')}>Cancelar renovacion</button>}
      {billing.data?.pendingCheckout && <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-3">
        <p>Checkout pendiente: {billing.data.pendingCheckout.plan}.</p>
        <button className="ofi-btn-secondary mt-2" disabled={busy} onClick={() => void manage(billing.data!.pendingCheckout!.id, 'cancel')}>
          Cancelar checkout pendiente</button>
      </div>}
      {billing.data && <div className="mt-5">
        <h3 className="font-semibold">Consumo de {billing.data.entitlements.period} (UTC)</h3>
        {(['trabajosPublicados', 'propuestasEnviadas'] as const).filter(key => billing.data!.entitlements.limits[key] !== 0).map(key => {
          const { limits, used } = billing.data!.entitlements;
          return <div className="mt-3 max-w-md" key={key}>
            <p className="mb-1 text-sm">{metricLabel(key)}: {used[key] ?? 0} / {limits[key] === -1 ? 'Sin limite' : limits[key]}</p>
            {limits[key] > 0 && <progress className="h-2 w-full accent-emerald-600" aria-label={metricLabel(key)} value={used[key] ?? 0} max={limits[key]} />}
          </div>;
        })}
        <h3 className="mt-6 font-semibold">Pagos confirmados</h3>
        {billing.data.payments.length === 0 && <p className="mt-2 text-sm text-gray-600">Todavia no hay pagos registrados.</p>}
        {billing.data.payments.map(payment => <div className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm" key={payment.id}>
          <span>{new Date(payment.paidAt).toLocaleDateString()} · Mercado Pago #{payment.id}</span>
          <span>{payment.currency} {(payment.amountMinor / 100).toLocaleString()} · {{ approved: 'Aprobado', refunded: 'Reintegrado', charged_back: 'Contracargo' }[payment.status]}
            {payment.refundedMinor > 0 && ' · Reintegrado: ' + (payment.refundedMinor / 100).toLocaleString()}</span>
        </div>)}
      </div>}
    </>}
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
  </section>;
}
