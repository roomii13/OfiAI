/** @archivo intelligence.routes.ts @descripcion Lectura analitica autenticada y limitada. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { intelligenceController as c } from '../controllers/intelligence.controller';
export const intelligenceRoutes = Router();
intelligenceRoutes.use(verificarAutenticacion,limitadorIA);
intelligenceRoutes.get('/',c.snapshot); intelligenceRoutes.post('/questions',c.ask);
