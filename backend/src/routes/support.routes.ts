/** @archivo support.routes.ts @descripcion Frontera autenticada y limitada de soporte. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { supportController as c } from '../controllers/support.controller';
export const supportRoutes = Router();
supportRoutes.use(verificarAutenticacion,limitadorIA);
supportRoutes.get('/sessions',c.list); supportRoutes.post('/sessions',c.start);
supportRoutes.get('/sessions/:id',c.get); supportRoutes.post('/sessions/:id/messages',c.message);
supportRoutes.get('/tickets',requerirRol('admin'),c.tickets);
supportRoutes.get('/tickets/:id',requerirRol('admin'),c.ticket);
supportRoutes.post('/tickets/:id/commands',requerirRol('admin'),c.command);
