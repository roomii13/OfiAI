/** @archivo pricing.worker.ts @descripcion Continúa Matching con Pricing sin alterar presupuestos ni contratar. */
import { jobsRepository } from '../repositories/jobs.repository';
import { companyRepository } from '../repositories/company.repository';
import { pricingService } from '../services/pricing.service';
import { notificationService } from '../services/notification.service';
/** Worker interno reutilizable; el flujo automatico no envia notificaciones. */
export async function pricingWorker(jobId: string, notify = true): Promise<void> {
  const job = await jobsRepository.findById(jobId);
  if (!job || ['cancelado', 'completado'].includes(job.estado)) return;
  const company = await companyRepository.findById(job.empresaId);
  if (!company) return;
  const view = await pricingService.execute(jobId, company.usuarioId, 'empresa');
  if (notify && view.result?.range) await notificationService.crearYEnviar({
    usuarioId: company.usuarioId, tipo: 'recomendacion_ia', canales: ['in_app'],
    datos: { tituloTrabajo: job.titulo, detalle: 'La estimacion orientativa de tu solicitud esta disponible para revisar.' },
  });
}
