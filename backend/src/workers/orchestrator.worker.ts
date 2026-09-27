/** @archivo orchestrator.worker.ts @descripcion Despacha solo eventos y roles conocidos; no impersona administradores. */
import { agentEventRepository } from '../repositories/agent-event.repository';
import { userRepository } from '../repositories/user.repository';
import { orchestratorService } from '../services/orchestrator.service';
import { logger } from '../config/logger';
/** Revalida cuenta antes de ejecutar; los intentos fallidos permanecen visibles en outbox. */
export async function orchestratorWorker():Promise<number> {
  let processed=0;
  for(const candidate of await agentEventRepository.due()) {
    const event=await agentEventRepository.claim(candidate.id);if(!event)continue;
    let success=false;
    try{
      const user=await userRepository.findById(event.ownerId);
      if(user?.activo&&user.rol==='empresa'){
        const run=await orchestratorService.execute({uid:event.ownerId,rol:'empresa'},
          {event:event.event,resourceId:event.resourceId,requestId:event.requestId});
        success=run.status!=='failed'&&run.status!=='processing';
      }
    }catch{logger.warn('Evento multiagente pendiente de reintento.',{eventId:event.id});}
    await agentEventRepository.finish(event,success);processed++;
  }
  return processed;
}
