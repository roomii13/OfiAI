/**
 * @archivo intake.d.ts
 * @descripcion Contratos versionados de Intake compartidos por API, web y Expo.
 */
export type IntakeField = 'category' | 'title' | 'description' | 'location' | 'urgency' | 'preferredDate' | 'estimatedScope' | 'requirements' | 'budget' | 'attachments' | 'workType';
export interface IntakeData {
  category: string | null;
  title: string | null;
  description: string | null;
  location: { country: string | null; city: string | null; region: string | null };
  urgency: 'low' | 'normal' | 'high' | 'emergency' | null;
  preferredDate: string | null;
  budget: { min: number | null; max: number | null; currency: string | null };
  budgetStatus: 'unknown' | 'provided' | 'to_quote';
  estimatedScope: string | null;
  requirements: string[];
  attachmentsRequired: boolean | null;
  attachmentReason: string | null;
  multipleProfessionals: boolean | null;
  professionalTypes: string[];
  workType: 'presencial' | 'remoto' | 'hibrido' | null;
}
export interface IntakeMessage {
  id: string; role: 'user' | 'assistant'; content: string; createdAt: string;
}
export interface IntakeResult {
  message: string;
  extractedData: IntakeData;
  missingInformation: IntakeField[];
  completionPercentage: number;
  readyToCreateJob: boolean;
}
export interface IntakeSession extends IntakeResult {
  id: string; schemaVersion: 1; companyId: string; userId: string;
  status: 'active' | 'ready' | 'published' | 'abandoned';
  version: number; messages: IntakeMessage[];
  createdAt: string; updatedAt: string; jobId: string | null;
}
export interface IntakeSessionSummary {
  id: string; title: string; status: IntakeSession['status']; updatedAt: string;
}
