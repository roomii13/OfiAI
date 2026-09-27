/** @archivo sales.controller.ts @descripcion Controlador fino del CRM y preferencias del titular. */
import { agentHttp } from './agent-http';
import { salesService } from '../services/sales.service';
export const salesController = {
  me: agentHttp(actor => salesService.get(actor)),
  save: agentHttp((actor, req) => salesService.optIn(actor, req.body)),
  reply: agentHttp((actor, req) => salesService.reply(actor, req.body)),
  list: agentHttp((actor, req) => salesService.list(actor, typeof req.query.cursor === 'string' ? req.query.cursor : undefined)),
  detail: agentHttp((actor, req) => salesService.get(actor, req.params.id)),
  command: agentHttp((actor, req) => salesService.command(actor, req.params.id!, req.body)),
};
