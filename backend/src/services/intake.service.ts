/**
 * @archivo intake.service.ts
 * @descripcion Orquesta autorizacion, agente, sesiones y trabajos sin llamadas IA desde UI.
 */
import { companyRepository } from '../repositories/company.repository';
import { intakeRepository } from '../repositories/intake.repository';
import { intakeAgent } from '../ai/agents/intake.agent';
import { assessIntake, emptyIntakeData } from '../ai/tools/intake-state.tool';
import { intakeIdSchema, type IntakeSession } from '../models/intake.model';
import { jobsService } from './jobs.service';
import { publicarEventoTrabajoCreado } from '../events/job-created.event';
import { esquemaCrearTrabajo } from '../validators/job.validator';
import { ApiError } from '../middleware/error.middleware';
import { GeminiIntakeError } from '../integrations/gemini/gemini.client';
import type { RolUsuario } from '../models/User';
import { logger } from '../config/logger';

/** Servicio del primer agente conversacional, con reglas de publicacion propias. */
export class IntakeService {
  /** Obtiene la empresa activa exclusivamente desde la identidad verificada. */
  private async company(userId: string, role: RolUsuario) {
    if (role !== 'empresa') throw new ApiError('Esta funcion esta disponible para empresas.', 403);
    const company = await companyRepository.findByUsuarioId(userId);
    if (!company) throw new ApiError('No se encontro el perfil de empresa activo.', 404);
    return company;
  }

  /** Valida identificadores antes de utilizarlos como rutas Firestore. */
  private validateId(id: string): void {
    if (!intakeIdSchema.safeParse(id).success) throw new ApiError('Identificador de conversacion invalido.', 400);
  }

  /** Inicia o recupera una sesion creada por el mismo comando. */
  async start(userId: string, role: RolUsuario, id: string): Promise<IntakeSession> {
    this.validateId(id);
    const company = await this.company(userId, role);
    const data = emptyIntakeData();
    const now = new Date().toISOString();
    const message = 'Hola, contame que servicio necesita tu empresa y lo vamos preparando juntos.';
    return intakeRepository.create({
      id, userId, companyId: company.id, schemaVersion: 1, version: 0, status: 'active',
      message, extractedData: data, ...assessIntake(data), jobId: null, createdAt: now, updatedAt: now,
      messages: [{ id: id + '-welcome', role: 'assistant', content: message, createdAt: now }],
    });
  }

  /** Recupera contexto y mensajes propios para continuar en cualquier dispositivo. */
  async get(userId: string, role: RolUsuario, id: string): Promise<IntakeSession> {
    this.validateId(id);
    const company = await this.company(userId, role);
    return intakeRepository.get(id, userId, company.id);
  }

  /** Lista conversaciones accesibles de la empresa autenticada. */
  async list(userId: string, role: RolUsuario) {
    const company = await this.company(userId, role);
    return intakeRepository.list(userId, company.id);
  }

  /** Ejecuta un turno real sin perder el contexto anterior si Gemini falla. */
  async message(userId: string, role: RolUsuario, id: string, input: { requestId: string; expectedVersion: number; message: string }): Promise<IntakeSession> {
    this.validateId(id);
    const company = await this.company(userId, role);
    const claimed = await intakeRepository.claim(id, userId, company.id, input.requestId, input.expectedVersion, input.message);
    if (claimed.replay) return claimed.session;
    try {
      const result = await intakeAgent.conversar(claimed.session, input.message);
      return await intakeRepository.finish(id, userId, company.id, input.requestId, input.message, result);
    } catch (error) {
      await intakeRepository.release(id, input.requestId).catch(() => {
        logger.warn('No se pudo liberar un turno Intake; el lease expirara automaticamente.');
      });
      if (error instanceof GeminiIntakeError) {
        const messages = {
          unavailable: 'La IA no esta disponible ahora. Tu conversacion sigue guardada; intenta de nuevo en un momento.',
          timeout: 'La IA tardo mas de lo esperado. No perdimos la conversacion; podes reintentar.',
          rate_limit: 'La IA alcanzo su limite temporal. Espera un momento antes de reintentar.',
          invalid_response: 'No pude interpretar la respuesta de la IA. No cambiamos tu solicitud; intenta de nuevo.',
        };
        throw new ApiError(messages[error.reason], error.reason === 'rate_limit' ? 429 : error.reason === 'timeout' ? 504 : 503);
      }
      throw error;
    }
  }

  /** Publica solo el estado completo de la version que la empresa confirma. */
  async confirm(userId: string, role: RolUsuario, id: string, version: number): Promise<IntakeSession> {
    this.validateId(id);
    const company = await this.company(userId, role);
    const published = await intakeRepository.publish(id, userId, company.id, version, session => {
      const data = session.extractedData;
      if (!assessIntake(data, session.missingInformation).readyToCreateJob) {
        throw new ApiError('Faltan datos para publicar la solicitud.', 409);
      }
      const input = esquemaCrearTrabajo.parse({
        titulo: data.title, descripcion: data.description, categoria: data.category,
        ciudad: data.location.city, tipoTrabajo: data.workType, estado: 'publicado',
        habilidadesRequeridas: data.requirements,
        presupuestoMinimo: data.budget.min ?? undefined, presupuestoMaximo: data.budget.max ?? undefined,
        moneda: data.budget.currency ?? 'ARS',
      });
      const job = jobsService.prepararTrabajo(company.id, input, 'ai_' + id);
      return {
        ...job, source: 'ai_intake', aiIntakeSessionId: id,
        companyId: job.empresaId, title: job.titulo, description: job.descripcion, category: job.categoria,
        location: data.location, urgency: data.urgency, budget: data.budget,
        preferredDate: data.preferredDate, requirements: data.requirements,
        estimatedScope: data.estimatedScope, attachmentsRequired: data.attachmentsRequired,
        attachmentReason: data.attachmentReason, multipleProfessionals: data.multipleProfessionals,
        professionalTypes: data.professionalTypes, status: job.estado,
        createdAt: job.fechaCreacion, updatedAt: job.fechaActualizacion,
      };
    });
    if (published.jobId) {
      await publicarEventoTrabajoCreado({ trabajoId: published.jobId, empresaId: company.id,
        categoria: published.extractedData.category ?? '', ciudad: published.extractedData.location.city ?? '',
        timestamp: new Date() });
    }
    return published;
  }

  /** Cierra la conversacion por decision explicita de su propietaria. */
  async abandon(userId: string, role: RolUsuario, id: string, version: number): Promise<IntakeSession> {
    this.validateId(id);
    const company = await this.company(userId, role);
    return intakeRepository.abandon(id, userId, company.id, version);
  }
}
export const intakeService = new IntakeService();
