/** @archivo billing.ts @descripcion Fechas de facturacion y montos enteros verificables sin proveedores externos. */
import type { Suscripcion } from '../models/Subscription';
import { ApiError } from '../middleware/error.middleware';
import { types } from 'node:util';
import { CONTRACT_FEE_POLICY_VERSION, CONTRACT_FEE_BASIS_POINTS } from '../constants/billing';
import type { ContractCharges } from '../../../shared/billing';

/** Calcula sobre el presupuesto del profesional y adiciona la comision al contratante. */
export function contractCharges(amount: number, currency: string, quoteId: string): ContractCharges {
  const professionalAmountMinor = amountMinor(amount);
  const feeMinor = calculateTransactionFee(professionalAmountMinor, CONTRACT_FEE_BASIS_POINTS);
  const contractorTotalMinor = professionalAmountMinor + feeMinor;
  if (!Number.isSafeInteger(contractorTotalMinor)) throw new ApiError('Importe invalido.', 400);
  return { policyVersion: CONTRACT_FEE_POLICY_VERSION, quoteId, currency, basisPoints: CONTRACT_FEE_BASIS_POINTS,
    professionalAmountMinor, feeMinor, contractorTotalMinor, payer: 'contractor',
    collectionEnabled: false, protectionEnabled: false };
}

/** Normaliza Date, ISO y Timestamp del SDK; rechaza valores corruptos. */
export function billingDate(value: unknown): Date {
  const date = types.isDate(value) ? new Date(value.getTime()) : value && typeof value === 'object' && 'toDate' in value
    && typeof value.toDate === 'function' ? value.toDate() as Date : new Date(typeof value === 'string' ? value : NaN);
  if (!Number.isFinite(date.getTime())) throw new ApiError('La fecha de facturacion no es valida.', 502);
  return date;
}
/** Suma un mes UTC conservando hora y ajustando los dias 29, 30 y 31 al ultimo dia disponible. */
export function nextBillingMonth(value: Date): Date {
  const date = new Date(value); const day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay)); return date;
}
/** Convierte monedas soportadas sin sumar importes decimales en el ledger. */
export function amountMinor(value: number): number {
  const amount = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount)) throw new ApiError('Importe invalido.', 400);
  return amount;
}
/** Solo periodos confirmados y no vencidos habilitan prestaciones pagas. */
export function hasPaidAccess(subscription: Suscripcion | null, now = new Date()): boolean {
  return Boolean(subscription && subscription.plan !== 'gratuito'
    && ['activa', 'trial'].includes(subscription.estado) && billingDate(subscription.fechaVencimiento) > now);
}
/** Calcula una comision indicativa; no ejecuta un cobro ni presume aceptacion del usuario. */
export function calculateTransactionFee(grossMinor: number, basisPoints: number): number {
  if (!Number.isSafeInteger(grossMinor) || grossMinor < 0 || !Number.isInteger(basisPoints)
    || basisPoints < 0 || basisPoints > 10000) throw new ApiError('Politica de comision invalida.', 400);
  return Number((BigInt(grossMinor) * BigInt(basisPoints) + 5000n) / 10000n);
}
