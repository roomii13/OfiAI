/** @archivo settlement.routes.ts @descripcion Cobros, cuenta profesional y panel de liquidaciones autorizado. */
import { Router, type Response, type NextFunction } from 'express';
import { verificarAutenticacion,type RequestAutenticada } from '../middleware/auth.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { settlementService as service } from '../services/settlement.service';
import { protectedContractError } from '../controllers/protected-contract.controller';
import { ApiError } from '../middleware/error.middleware';
/** Adaptador HTTP; las reglas y calculos permanecen en servicios y repositorios. */
function handle(action:'overview'|'account'|'saveAccount'|'verifyAccount'|'record'|'checkout') {
  return async(req:RequestAutenticada,res:Response,next:NextFunction):Promise<void>=>{
    try {
      if(!req.usuario) throw new ApiError('Inicia sesion.',401);
      const actor=req.usuario; const id=String(req.params.id ?? ''); let datos:unknown;
      if(action==='overview' || action==='account') datos=await service[action](actor);
      else if(action==='saveAccount') { await service.saveAccount(actor,req.body); datos={ saved:true }; }
      else if(action==='checkout') datos=await service.checkout(actor,id);
      else { await service[action](actor,id,req.body); datos={ saved:true }; }
      res.setHeader('Cache-Control','no-store'); res.json({ exito:true,datos });
    } catch(error) { next(error); }
  };
}
export const settlementRoutes=Router();
settlementRoutes.post('/webhooks/mercadopago',async(req,res,next)=>{
  try { await service.webhook(req.body,req.get('x-signature'),req.get('x-request-id'),req.query['data.id']); res.json({ exito:true }); }
  catch(error) { next(error); }
});
settlementRoutes.use(verificarAutenticacion);
settlementRoutes.get('/',handle('overview'));
settlementRoutes.get('/account',handle('account'));
settlementRoutes.put('/account',limitadorIA,handle('saveAccount'));
settlementRoutes.post('/accounts/:id/verify',limitadorIA,handle('verifyAccount'));
settlementRoutes.post('/:id/record-transfer',limitadorIA,handle('record'));
settlementRoutes.post('/:id/checkout',limitadorIA,handle('checkout'));
settlementRoutes.use(protectedContractError);
