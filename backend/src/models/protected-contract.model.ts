/** @archivo protected-contract.model.ts @descripcion Datos privados del expediente y permisos financieros revocables. */
import type { ProtectedContractView, ContractPolicy } from '../../../shared/protected-contract';
import type { RolUsuario } from './User';
export type { ContractPolicy, ContractBreakdown, ProtectedContractView, FinancialState } from '../../../shared/protected-contract';
/** Identidad derivada del ID token verificado; nunca se deserializa desde el cuerpo HTTP. */
export interface FinancialActor {
  uid: string; rol: RolUsuario; email?: string; emailVerificado?: boolean; secondFactor?: boolean; authTime?: number;
}
export interface FinancialGrant {
  uid: string; role: 'OWNER' | 'DISPUTE_ADMIN'; active: boolean; revision: number;
  permissions: Array<'view' | 'communicate' | 'propose' | 'resolve' | 'finance'>;
  limitsMinor: Record<string, number>; updatedAt: string;
}
export interface StoredProtectedContract extends Omit<ProtectedContractView, 'collectionEnabled'> {
  companyUid: string; professionalUid: string; professionalId: string;
  quoteFingerprint: string; policy: ContractPolicy;
  resolutionProposer: string | null; resolutionApprovers: string[]; assignedUid: string | null;
  approvalGrantVersions: Record<string, number>;
  paymentReviewRequired?: boolean;
}
