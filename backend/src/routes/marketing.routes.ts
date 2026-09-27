/** @archivo marketing.routes.ts @descripcion Administracion exclusiva de campanas y evidencia. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { marketingController as c } from '../controllers/marketing.controller';
export const marketingRoutes = Router();
marketingRoutes.use(verificarAutenticacion,requerirRol('admin'),limitadorIA);
marketingRoutes.get('/',c.list); marketingRoutes.post('/',c.create);
marketingRoutes.get('/:id',c.get); marketingRoutes.post('/:id/commands',c.command);
marketingRoutes.post('/:id/reports',c.report);
marketingRoutes.post('/:id/content',c.content);
marketingRoutes.get('/:id/insights',c.insights);
