/**
 * @archivo intake.test.ts
 * @descripcion Esquemas, completitud, contexto y limites de la salida generativa.
 */
import { assessIntake, emptyIntakeData } from '../../src/ai/tools/intake-state.tool';
import { intakeConfirmSchema, intakeMessageSchema, intakeModelResponseSchema } from '../../src/models/intake.model';
import { intakeConversation, intakeSystemPrompt } from '../../src/ai/prompts/intake.prompt';
import { completeIntakeData } from '../intake-fixtures';
import type { IntakeSession } from '../../src/models/intake.model';

it('inicia en cero sin inventar ubicacion ni presupuesto', () => {
  const data = emptyIntakeData();
  expect(assessIntake(data)).toMatchObject({ completionPercentage: 0, readyToCreateJob: false });
  expect(data.location.city).toBeNull(); expect(data.budget.min).toBeNull();
});
it('considera completa una solicitud a cotizar sin exigir fotos', () => {
  expect(assessIntake(completeIntakeData(), ['budget'])).toMatchObject({ completionPercentage: 100, readyToCreateJob: true });
});
it('el servidor bloquea ubicacion faltante aunque el modelo diga que no falta nada', () => {
  const data = completeIntakeData(); data.location.city = null;
  expect(assessIntake(data, []).missingInformation).toContain('location');
  expect(assessIntake(data).readyToCreateJob).toBe(false);
});
it('exige moneda cuando hay montos y rechaza montos contradictorios', () => {
  const data = completeIntakeData();
  data.budgetStatus = 'provided'; data.budget.min = 100;
  expect(assessIntake(data).missingInformation).toContain('budget');
  const response = { message: 'Resumen', extractedData: data, missingInformation: [] };
  data.budget.min = 0;
  expect(intakeModelResponseSchema.safeParse(response).success).toBe(false);
  data.budget.min = 100; data.budgetStatus = 'to_quote';
  expect(intakeModelResponseSchema.safeParse(response).success).toBe(false);
});
it('permite categorias extensibles y rechaza estados invalidos', () => {
  const good = { message: 'Revisa el resumen.', extractedData: { ...completeIntakeData(), category: 'Restauracion de vitrales' }, missingInformation: [] };
  expect(intakeModelResponseSchema.safeParse(good).success).toBe(true);
  expect(intakeModelResponseSchema.safeParse({ ...good, readyToCreateJob: true }).success).toBe(false);
  expect(intakeModelResponseSchema.safeParse({ ...good, extractedData: { ...good.extractedData, budget: { min: 100, max: 1, currency: 'ARS' } } }).success).toBe(false);
});
it('no acepta confirmacion implicita ni datos del trabajo enviados por el cliente', () => {
  expect(intakeConfirmSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  expect(intakeConfirmSchema.safeParse({ expectedVersion: 1, confirmed: false }).success).toBe(false);
  expect(intakeConfirmSchema.safeParse({ expectedVersion: 1, confirmed: true, companyId: 'otro' }).success).toBe(false);
});
it('rechaza mensajes vacios, excesivos y contexto falsificado', () => {
  const base = { requestId: 'request-1234567890', expectedVersion: 0 };
  expect(intakeMessageSchema.safeParse({ ...base, message: '   ' }).success).toBe(false);
  expect(intakeMessageSchema.safeParse({ ...base, message: 'a'.repeat(4001) }).success).toBe(false);
  expect(intakeMessageSchema.safeParse({ ...base, message: 'Hola', extractedData: completeIntakeData() }).success).toBe(false);
});
it('incluye el historial anterior sin convertirlo en instrucciones del sistema', () => {
  const session = { extractedData: emptyIntakeData(), messages: [{ role: 'user', content: '18 departamentos' }, { role: 'assistant', content: 'En que ciudad?' }] } as IntakeSession;
  const prompt = JSON.parse(intakeConversation(session, 'Santa Rosa'));
  expect(prompt.conversation).toHaveLength(2); expect(prompt.newUserMessage).toBe('Santa Rosa');
  expect(intakeSystemPrompt('2026-09-23')).toContain('No publiques');
});
