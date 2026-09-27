/** @archivo sales.routes.ts @descripcion Rutas CRM autenticadas; sin captacion externa indiscriminada. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { salesController as c } from '../controllers/sales.controller';
export const salesRoutes = Router();
salesRoutes.use(verificarAutenticacion, limitadorIA);
salesRoutes.get('/me', c.me);
salesRoutes.put('/me', c.save);
salesRoutes.post('/me/reply', c.reply);
salesRoutes.get('/leads', requerirRol('admin'), c.list);
salesRoutes.get('/leads/:id', requerirRol('admin'), c.detail);
salesRoutes.post('/leads/:id/commands', requerirRol('admin'), c.command);
