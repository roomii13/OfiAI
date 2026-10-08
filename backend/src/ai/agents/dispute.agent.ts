/** @archivo dispute.agent.ts @descripcion Agente asistencial sin acceso directo a Firestore ni capacidades financieras. */
import { z } from 'zod';
import { businessAi } from '../tools/business-ai.tool';
import { DISPUTE_PROMPT, DISPUTE_PROMPT_VERSION } from '../prompts/dispute.prompt';
import { matchingText } from '../../domain/matching/matching';
import { redactSecrets } from '../../validators/support.validator';
import type { FinancialActor, StoredProtectedContract } from '../../models/protected-contract.model';
import type { ContractEntry, DisputeAdvice } from '../../../../shared/protected-contract';
const schema = z.object({ summary: z.string().min(10).max(1800), questions: z.array(z.string().max(250)).max(6),
  alternatives: z.array(z.string().max(300)).max(5), evidenceIds: z.array(z.string().uuid()).max(20) }).strict();
/** Recibe exclusivamente el expediente ya autorizado; no puede buscar otros usuarios. */
export async function assistDispute(actor: FinancialActor, contract: StoredProtectedContract, entries: ContractEntry[]): Promise<DisputeAdvice> {
  const ids = entries.flatMap(entry => entry.evidenceId ? [entry.evidenceId] : []);
  const fallback = { summary: 'El reclamo requiere revision humana de las condiciones aceptadas y las evidencias de ambas partes.',
    questions: ['Que condicion del presupuesto se considera incumplida?', 'Que evidencia aporta cada parte sobre la finalizacion?'],
    alternatives: ['Solicitar informacion adicional antes de tomar una decision.'], evidenceIds: ids.slice(0,20) };
  const result = await businessAi({ actor, agent: 'disputes', promptVersion: DISPUTE_PROMPT_VERSION, system: DISPUTE_PROMPT,
    data: { reason: matchingText(redactSecrets(contract.dispute?.reason ?? ''), 1500), workState: contract.workState,
      financialState: contract.financialState, entries: entries.slice(-20).map(entry => ({ id: entry.id, evidenceId: entry.evidenceId ?? null,
        kind: entry.kind, text: matchingText(redactSecrets(entry.text), 500) })) }, schema, fallback,
    jsonSchema: { type: 'object', properties: { summary: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } },
      alternatives: { type: 'array', items: { type: 'string' } }, evidenceIds: { type: 'array', items: { type: 'string' } } },
      required: ['summary','questions','alternatives','evidenceIds'], additionalProperties: false },
    validate: value => value.evidenceIds.every(id => ids.includes(id)),
  });
  return { ...result.value, generatedBy: result.usedAi ? 'ai' : 'rules', requiresHumanReview: true };
}
