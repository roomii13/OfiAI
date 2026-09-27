/** @archivo marketing.controller.ts @descripcion Adaptador HTTP de campanas. */
import { agentHttp } from './agent-http';
import { marketingService as s } from '../services/marketing.service';
export const marketingController = {
  content:agentHttp((actor,req)=>s.content(actor,req.params.id!,req.body)),
  insights:agentHttp((actor,req)=>s.insights(actor,req.params.id!)),
  list: agentHttp(actor => s.list(actor)),
  create: agentHttp((actor,req) => s.create(actor,req.body)),
  get: agentHttp((actor,req) => s.get(actor,req.params.id!)),
  command: agentHttp((actor,req) => s.command(actor,req.params.id!,req.body)),
  report: agentHttp((actor,req) => s.report(actor,req.params.id!,req.body)),
};
