/** @archivo marketing.service.ts @descripcion Campanas aprobadas y metricas con procedencia visible. */
import { marketingAgent } from '../ai/agents/marketing.agent';
import { marketingRepository } from '../repositories/marketing.repository';
import { campaignSchema, campaignActionSchema, marketingReportSchema,campaignContentSchema } from '../validators/marketing.validator';
import { intelligenceService } from './intelligence.service';
import { salesIdSchema } from '../validators/sales.validator';
import { adminOnly, input } from '../validators/agent.validator';
import { ApiError } from '../middleware/error.middleware';
import type { AgentActor } from '../models/agent.model';
/** No afirma que contenido exportable sea una publicacion real en redes. */
export class MarketingService {
  /** Permite revision humana del contenido antes del primer envio. */
  async content(actor:AgentActor,id:string,raw:unknown) {
    await this.get(actor,id);const data=input(campaignContentSchema,raw);
    await marketingRepository.content(id,data.version,data.variants);return this.get(actor,id);
  }
  /** Recibe datos del Analytics Agent y los contrasta con evidencia propia de la campana. */
  async insights(actor:AgentActor,id:string) {
    const detail=await this.get(actor,id);const snapshot=await intelligenceService.snapshot(actor);
    return {campaignId:id,market:snapshot.categories.slice(0,10),cities:snapshot.cities.slice(0,10),
      reports:detail.reports,limitations:['Las metricas de campana son declaradas por administracion.','Las distribuciones de Analytics pueden ser parciales.'],
      nextAction:detail.reports.length?'Comparar variantes dentro del mismo periodo, fuente y audiencia. No se atribuye causalidad sin un experimento controlado.':'Registrar evidencia antes de decidir sobre adquisicion o presupuesto.'};
  }
  /** Construye dos variantes auditables para una hipotesis explicita. */
  async create(actor: AgentActor, raw: unknown) {
    adminOnly(actor); const data = input(campaignSchema, raw);
    const first = marketingAgent.generarMensaje({ tipo: data.objective, segmento: data.audience });
    const alternative=await marketingAgent.draft(actor,first);
    const now = new Date().toISOString();
    return marketingRepository.create({ ...data, variants: [
      { id: 'A', title: first.asunto, body: first.cuerpo, cta: first.llamadoAccion },
      { id: 'B', title: alternative.asunto===first.asunto?'Tu proximo paso en OfiAI':alternative.asunto,
        body: alternative.cuerpo,cta: alternative.llamadoAccion }],
      status: 'draft', version: 1, createdAt: now, updatedAt: now, approvedBy: null,
      cursor: null, delivered: 0, createdBy: actor.uid });
  }
  /** Lista campanas privadas del negocio. */
  async list(actor: AgentActor) { adminOnly(actor); return marketingRepository.list(); }
  /** Obtiene contenido y evidencia acotada. */
  async get(actor: AgentActor, id: string) {
    adminOnly(actor); input(salesIdSchema,id); const campaign = await marketingRepository.get(id);
    if (!campaign) throw new ApiError('Campana no encontrada.',404);
    return { campaign, reports: await marketingRepository.reports(id) };
  }
  /** Despacha solo el canal conectado; otros quedan como contenido para revision. */
  async command(actor: AgentActor, id: string, raw: unknown) {
    const { campaign } = await this.get(actor,id); const data = input(campaignActionSchema,raw);
    if (campaign.version !== data.version) throw new ApiError('La campana cambio.',409);
    if (data.action === 'dispatch') {
      if (campaign.channel !== 'in_app') throw new ApiError('Este canal requiere conectar y aprobar su proveedor de publicacion.',409);
      return { delivered: await marketingRepository.dispatch(campaign) };
    }
    await marketingRepository.state(id,data.version,data.action === 'approve' ? 'approved' : 'paused',actor.uid);
    return this.get(actor,id);
  }
  /** Importa evidencia identificada: no inventa CAC/LTV ni confunde ROAS con ROI. */
  async report(actor: AgentActor, id: string, raw: unknown) {
    const { campaign } = await this.get(actor,id); const data = input(marketingReportSchema,raw);
    if (data.currency !== campaign.currency) throw new ApiError('La moneda debe coincidir con la campana.',400);
    const metrics = marketingAgent.metrics(data);
    const report = { ...data, campaignId: id, metrics, evidence: 'admin_reported' as const, createdAt: new Date().toISOString() };
    await marketingRepository.report(report); return report;
  }
}
export const marketingService = new MarketingService();
