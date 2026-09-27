/** @archivo operations.controller.ts @descripcion Adaptadores HTTP para operadores y Command Center. */
import { agentHttp } from './agent-http';
import { operationsService as s } from '../services/operations.service';
export const operationsController={
  list:agentHttp((actor,req)=>s.list(actor,req.query)),
  command:agentHttp((actor,req)=>s.command(actor,req.body)),
  center:agentHttp((actor,req)=>s.center(actor,typeof req.query.month==='string'?req.query.month:undefined)),
};
