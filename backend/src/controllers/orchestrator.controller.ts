/** @archivo orchestrator.controller.ts @descripcion Endpoints del recorrido multiagente. */
import { agentHttp } from './agent-http';
import { orchestratorService as s } from '../services/orchestrator.service';
export const orchestratorController = {
  execute: agentHttp((actor,req)=>s.execute(actor,req.body)),
  list: agentHttp(actor=>s.list(actor)),
  get: agentHttp((actor,req)=>s.get(actor,req.params.id!)),
};
