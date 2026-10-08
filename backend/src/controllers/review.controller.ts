/** @archivo review.controller.ts @descripcion Adaptadores HTTP sin decisiones de permisos ni persistencia. */
import { agentHttp } from './agent-http';
import { reviewService } from '../services/review.service';
export const reviewController = {
  get: agentHttp((actor, req) => reviewService.get(req.params.id!, actor)),
  create: agentHttp((actor, req) => reviewService.create(req.params.id!, actor, req.body)),
};
