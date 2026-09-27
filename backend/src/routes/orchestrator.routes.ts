/** @archivo orchestrator.routes.ts @descripcion Autenticacion y cuota HTTP antes de cualquier herramienta. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { orchestratorController as c } from '../controllers/orchestrator.controller';
export const orchestratorRoutes = Router();
orchestratorRoutes.use(verificarAutenticacion,limitadorIA);
orchestratorRoutes.get('/runs',c.list); orchestratorRoutes.post('/runs',c.execute); orchestratorRoutes.get('/runs/:id',c.get);
