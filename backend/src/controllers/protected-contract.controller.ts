/** @archivo protected-contract.controller.ts @descripcion Adaptador HTTP sin decisiones comerciales o financieras. */
import type { Response, NextFunction, Request } from 'express';
import type { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { protectedContractService as service } from '../services/protected-contract.service';
/** La identidad y MFA provienen unicamente del middleware Firebase. */
export function protectedContractHandler(action: 'get'|'prepare'|'command'|'entries'|'history'|'list'|'policy'|'getPolicy'|'grant'|'advice'|'upload'|'download') {
  return async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.usuario; if (!actor) throw new ApiError('Inicia sesion para continuar.',401);
      const id = String(req.params.id ?? ''); let datos: unknown;
      res.setHeader('Cache-Control','no-store');
      if (action === 'download') {
        const bytes = await service.downloadEvidence(id,actor,String(req.params.evidenceId));
        res.setHeader('Content-Type','application/octet-stream'); res.setHeader('Content-Disposition','attachment; filename="evidencia"'); res.send(bytes); return;
      }
      if (action === 'list') datos = await service.list(actor);
      else if(action==='getPolicy') datos=await service.getPolicy(actor,String(req.params.currency));
      else if (action === 'policy' || action === 'grant') { await service[action](actor,req.body); datos = { saved:true }; }
      else if (action === 'upload') datos = await service.uploadEvidence(id,actor,req.body);
      else if (action === 'command') datos = await service.command(id,actor,req.body);
      else datos = await service[action](id,actor);
      res.json({ exito:true,datos });
    } catch (error) { next(error); }
  };
}
/** Nunca expone errores internos, credenciales o stack traces del proveedor. */
export function protectedContractError(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  res.status(error instanceof ApiError ? error.codigoEstado : 503).json({ exito:false,
    mensaje:error instanceof ApiError ? error.message : 'No se pudo completar la operacion. Consulta el estado antes de reintentar.' });
}
