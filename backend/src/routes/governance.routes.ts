/** @archivo governance.routes.ts @descripcion Gobierno IA exclusivo de administracion. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { agentHttp } from '../controllers/agent-http';
import { governanceService as s } from '../services/governance.service';
export const governanceRoutes=Router(); governanceRoutes.use(verificarAutenticacion,requerirRol('admin'),limitadorIA);
governanceRoutes.get('/',agentHttp(actor=>s.overview(actor)));
governanceRoutes.post('/:id/reviews',agentHttp((actor,req)=>s.feedback(actor,req.params.id!,req.body)));
