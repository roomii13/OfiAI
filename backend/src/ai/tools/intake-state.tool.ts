/**
 * @archivo intake-state.tool.ts
 * @descripcion Reglas deterministas de completitud independientes de Gemini.
 */
import type { IntakeData, IntakeField, IntakeResult } from '../../models/intake.model';

/** Inicializa una solicitud sin inventar valores, ubicacion ni presupuesto. */
export function emptyIntakeData(): IntakeData {
  return {
    category: null, title: null, description: null,
    location: { country: null, city: null, region: null },
    urgency: null, preferredDate: null, budget: { min: null, max: null, currency: null },
    budgetStatus: 'unknown', estimatedScope: null, requirements: [],
    attachmentsRequired: null, attachmentReason: null,
    multipleProfessionals: null, professionalTypes: [], workType: null,
  };
}

/** Calcula bloqueantes de publicacion; presupuesto y adjuntos no son obligatorios. */
export function assessIntake(data: IntakeData, suggested: IntakeField[] = []): Omit<IntakeResult, 'message' | 'extractedData'> {
  const required: Array<[IntakeField, boolean]> = [
    ['category', Boolean(data.category)], ['title', (data.title?.length ?? 0) >= 5],
    ['description', (data.description?.length ?? 0) >= 20],
    ['location', Boolean(data.location.country && data.location.city)],
    ['urgency', data.urgency !== null], ['preferredDate', Boolean(data.preferredDate)],
    ['estimatedScope', Boolean(data.estimatedScope)], ['workType', data.workType !== null],
  ];
  const missing = new Set<IntakeField>(required.filter(([, valid]) => !valid).map(([key]) => key));
  if ((data.budget.min !== null || data.budget.max !== null) && !data.budget.currency) missing.add('budget');
  for (const key of suggested) {
    if (key === 'budget' && data.budgetStatus === 'to_quote') continue;
    missing.add(key);
  }
  return {
    missingInformation: [...missing],
    completionPercentage: missing.size === 0 ? 100 : Math.max(0, Math.min(90, Math.round(required.filter(([, valid]) => valid).length / (required.length + [...missing].filter(key => !required.some(([field]) => field === key)).length) * 100))),
    readyToCreateJob: missing.size === 0,
  };
}
