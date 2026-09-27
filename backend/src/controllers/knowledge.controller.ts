/** @archivo knowledge.controller.ts @descripcion Memoria explicita con operaciones acotadas. */
import { agentHttp } from './agent-http';
import { knowledgeService as s } from '../services/knowledge.service';
export const knowledgeController={
  list: agentHttp((actor,req)=>s.list(actor,req.query.scope??'private',typeof req.query.jobId==='string'?req.query.jobId:undefined)),
  create: agentHttp((actor,req)=>s.create(actor,req.body)), search: agentHttp((actor,req)=>s.search(actor,req.body)),
  command: agentHttp((actor,req)=>s.command(actor,req.params.id!,req.body)),
};
