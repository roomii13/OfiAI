/** @archivo ContractChargesPanel.tsx @descripcion Desglose autoritativo y estado honesto de la proteccion de pagos. */
import type { ContractCharges } from '../../../shared/billing';

/** Nunca presenta una previsualizacion como pago retenido, garantia vigente o ingreso cobrado. */
export function ContractChargesPanel({ charges }: { charges?: ContractCharges | null }) {
  /** Muestra unidades menores sin recalcular el porcentaje en el cliente. */
  function money(minor: number): string { return (minor / 100).toLocaleString('es-AR', { style: 'currency', currency: charges!.currency }); }
  return <section className="coordinator-section" aria-label="Importes y proteccion del pago">
    <h2>Importes de la contratacion</h2>
    {charges ? <dl className="grid gap-3 sm:grid-cols-3">
      <div><dt>Importe del profesional</dt><dd>{money(charges.professionalAmountMinor)}</dd></div>
      <div><dt>Comision OfiAI del contratante ({charges.basisPoints / 100}%)</dt><dd>{money(charges.feeMinor)}</dd></div>
      <div><dt>Total del contratante</dt><dd className="font-semibold">{money(charges.contractorTotalMinor)}</dd></div>
    </dl> : <p>La comision OfiAI es del 10% adicional al contratante por contratacion efectiva. No se descuenta de los honorarios del profesional.</p>}
    <p className="mt-3 text-sm">Este presupuesto no es un comprobante de pago. Los cobros se confirman exclusivamente con Mercado Pago.</p>
    <p className="mt-3 text-sm">La comision de OfiAI se suma al importe del profesional. Los costos del proveedor deben figurar por separado antes de confirmar el pago.</p>
  </section>;
}
