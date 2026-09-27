/** @archivo support.controller.ts @descripcion Adaptador HTTP de sesiones y tickets. */
import { agentHttp } from './agent-http';
import { supportService as s } from '../services/support.service';
export const supportController = {
  list: agentHttp(actor => s.list(actor)), start: agentHttp((actor,req) => s.start(actor,req.body)),
  get: agentHttp((actor,req) => s.get(actor,req.params.id!)),
  message: agentHttp((actor,req) => s.message(actor,req.params.id!,req.body)),
  tickets: agentHttp(actor => s.tickets(actor)), ticket: agentHttp((actor,req) => s.ticket(actor,req.params.id!)),
  command: agentHttp((actor,req) => s.command(actor,req.params.id!,req.body)),
};
