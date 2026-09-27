/** @archivo intelligence.controller.ts @descripcion Analytics conversacional y command center. */
import { agentHttp } from './agent-http';
import { intelligenceService as s } from '../services/intelligence.service';
export const intelligenceController = {
  snapshot: agentHttp((actor,req) => s.snapshot(actor,typeof req.query.month === 'string' ? req.query.month : undefined)),
  ask: agentHttp((actor,req) => s.ask(actor,req.body)),
};
