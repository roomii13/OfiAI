/** @archivo knowledge.routes.ts @descripcion Conocimiento y memoria detras de autenticacion. */
import { Router } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { knowledgeController as c } from '../controllers/knowledge.controller';
export const knowledgeRoutes=Router(); knowledgeRoutes.use(verificarAutenticacion,limitadorIA);
knowledgeRoutes.get('/',c.list); knowledgeRoutes.post('/',c.create); knowledgeRoutes.post('/search',c.search);
knowledgeRoutes.post('/:id/commands',c.command);
