/**
 * @archivo intake.model.ts
 * @descripcion Validacion de estado, comandos y respuestas estructuradas de Intake.
 */
import { z } from 'zod';
export type { IntakeData, IntakeResult, IntakeSession, IntakeField } from '../../../shared/intake';

/** Claves extensibles del estado que pueden necesitar una aclaracion. */
export const intakeFields = ['category', 'title', 'description', 'location', 'urgency', 'preferredDate', 'estimatedScope', 'requirements', 'budget', 'attachments', 'workType'] as const;
const text = z.string().trim().min(1).max(4000).nullable();
const shortText = z.string().trim().min(1).max(200).nullable();
/** Estado completo generado por el modelo, nunca aceptado como autoridad desde un cliente. */
export const intakeDataSchema = z.object({
  category: shortText, title: z.string().trim().min(1).max(180).nullable(),
  description: text,
  location: z.object({ country: shortText, city: shortText, region: shortText }).strict(),
  urgency: z.enum(['low', 'normal', 'high', 'emergency']).nullable(),
  preferredDate: shortText,
  budget: z.object({
    min: z.number().finite().positive().max(1e12).nullable(),
    max: z.number().finite().positive().max(1e12).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
  budgetStatus: z.enum(['unknown', 'provided', 'to_quote']),
  estimatedScope: text, requirements: z.array(z.string().trim().min(1).max(500)).max(20),
  attachmentsRequired: z.boolean().nullable(), attachmentReason: text,
  multipleProfessionals: z.boolean().nullable(),
  professionalTypes: z.array(z.string().trim().min(1).max(100)).max(10),
  workType: z.enum(['presencial', 'remoto', 'hibrido']).nullable(),
}).strict()
  .refine(data => data.budget.min === null || data.budget.max === null || data.budget.min <= data.budget.max, 'Presupuesto inconsistente')
  .refine(data => data.budgetStatus !== 'to_quote' || (data.budget.min === null && data.budget.max === null), 'Un presupuesto a cotizar no tiene montos');
/** Solo la respuesta del proveedor utiliza este esquema; los porcentajes se calculan en servidor. */
export const intakeModelResponseSchema = z.object({
  message: z.string().trim().min(1).max(2400),
  extractedData: intakeDataSchema,
  missingInformation: z.array(z.enum(intakeFields)).max(11),
}).strict();
export const intakeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/);
export const intakeStartSchema = z.object({ requestId: intakeIdSchema }).strict();
export const intakeMessageSchema = z.object({
  requestId: intakeIdSchema, expectedVersion: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(4000),
}).strict();
export const intakeConfirmSchema = z.object({
  confirmed: z.literal(true), expectedVersion: z.number().int().nonnegative(),
}).strict();
export const intakeAbandonSchema = z.object({ expectedVersion: z.number().int().nonnegative() }).strict();
