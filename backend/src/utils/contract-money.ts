/** @archivo contract-money.ts @descripcion Motor monetario entero con redondeo explicito y gross-up verificable. */
import type { ContractPolicy, ContractBreakdown } from '../models/protected-contract.model';
import { ApiError } from '../middleware/error.middleware';
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
/** Rechaza importes no representables, en lugar de truncarlos silenciosamente. */
export function safeMinor(value: bigint): number {
  if (value < 0n || value > MAX) throw new ApiError('Importe fuera del rango permitido.', 400);
  return Number(value);
}
/** Redondeo half-up de tasas en puntos basicos, usando unicamente enteros. */
export function bpsAmount(amount: bigint, bps: number): bigint { return (amount * BigInt(bps) + 5000n) / 10000n; }
/** Convierte el presupuesto legado decimal del servidor sin multiplicaciones de coma flotante. */
export function decimalToMinor(value: number, digits: number): number {
  const text = String(value);
  if (!Number.isFinite(value) || !/^\d+(\.\d+)?$/.test(text) || digits < 0 || digits > 3)
    throw new ApiError('Moneda o importe no compatible.', 400);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > digits) throw new ApiError('El presupuesto tiene mas decimales que la moneda.', 400);
  return safeMinor(BigInt(whole!) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0'));
}
/** El contratante cubre los cargos; no se descuenta la comision del neto profesional. */
export function calculateContractCharges(professionalMinor: number, category: string, policy: ContractPolicy): ContractBreakdown {
  if (!Number.isSafeInteger(professionalMinor) || professionalMinor <= 0) throw new ApiError('Presupuesto invalido.', 400);
  const net = BigInt(professionalMinor); const rate = Object.hasOwn(policy.categoryBps,category) ? policy.categoryBps[category]! : policy.commissionBps;
  const commission = bpsAmount(net, rate); const platformTax = bpsAmount(commission, policy.platformTaxBps);
  const base = net + commission + platformTax;
  /** Costos calculados sobre el total cobrado, sin asumir que la base es solo el presupuesto. */
  const costs = (total: bigint) => {
    const processing = bpsAmount(total, policy.processorBps) + BigInt(policy.processorFixedMinor);
    const tax = bpsAmount(processing, policy.processorTaxBps);
    const withholding = bpsAmount(total, policy.withholdingBps);
    return { processing, tax, withholding, total: processing + tax + withholding };
  };
  let low = base;
  for (let iteration = 0; ; iteration++) {
    const next = base + costs(low).total;
    safeMinor(next);
    if (next === low) break;
    if (iteration >= 512) throw new ApiError('Las tasas no permiten calcular un total estable.', 400);
    low = next;
  }
  const fees = costs(low);
  // El maximo sobrante por redondeo pertenece al neto estimado de la plataforma y queda visible.
  return { policyVersion: policy.version, termsVersion: policy.termsVersion, currency: policy.currency, minorDigits: policy.minorDigits,
    professionalMinor, commissionBps: rate, commissionMinor: safeMinor(commission), processingMinor: safeMinor(fees.processing),
    taxMinor: safeMinor(platformTax + fees.tax), withholdingMinor: safeMinor(fees.withholding), clientTotalMinor: safeMinor(low),
    platformNetEstimatedMinor: safeMinor(low - net - fees.total - platformTax), professionalNetEstimatedMinor: professionalMinor,
    professionalNetConfirmedMinor: null, chargesVerified: policy.providerChargesVerified };
}
