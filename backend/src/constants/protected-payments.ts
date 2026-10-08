/** @archivo protected-payments.ts @descripcion Politica inicial prudente: costos desconocidos no equivalen a cero confirmado. */
import type { ContractPolicy } from '../models/protected-contract.model';
import { CONTRACT_FEE_BASIS_POINTS, CONTRACT_FEE_POLICY_VERSION } from './billing';
export const PROTECTED_COLLECTIONS = { contracts: 'contract_agreements', grants: 'financial_grants', policies: 'contract_policies', audit: 'financial_audit' } as const;
/** Unicos correos autorizados para OWNER; no se pueden ampliar desde la API ni desde el cliente. */
export const FINANCIAL_OWNER_EMAILS: readonly string[] = ['romina.celis33@gmail.com', 'rom-cel@live.com.ar'];
export const CURRENCY_DIGITS: Readonly<Record<string, number>> = { ARS: 2, USD: 2, EUR: 2, BRL: 2, CLP: 0, UYU: 2, MXN: 2, PEN: 2, COP: 2 };
/** Referencia publica, no tarifa contractual verificada de la cuenta. IVA separado para no redondear tasas. */
export const MERCADOPAGO_ARS_CHECKOUT_REFERENCE = {
  processorBps: 629,
  processorTaxBps: 2100,
  settlementDays: 0,
  checkedOn: '2026-10-08',
  source: 'https://www.mercadopago.com.ar/herramientas-para-vender/check-out',
} as const;
/** No mezcla monedas ni utiliza conversiones para determinar umbrales financieros. */
export function defaultContractPolicy(currency: string): ContractPolicy {
  const reference = currency === 'ARS' ? MERCADOPAGO_ARS_CHECKOUT_REFERENCE : null;
  return { version: CONTRACT_FEE_POLICY_VERSION + (reference ? '-mp-instant-reference' : ''), currency, minorDigits: CURRENCY_DIGITS[currency] ?? -1,
    commissionBps: CONTRACT_FEE_BASIS_POINTS, categoryBps: {}, processorBps: reference?.processorBps ?? 0, processorFixedMinor: 0,
    processorTaxBps: reference?.processorTaxBps ?? 0, platformTaxBps: 0, withholdingBps: 0,
    providerChargesVerified: false, termsVersion: 'draft-2026-10-08', dualApprovalMinor: 0 };
}
