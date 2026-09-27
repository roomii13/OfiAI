/** @archivo agent.validator.ts @descripcion Validacion reusable de casos de uso sin dependencias HTTP. */
import type { ZodType } from 'zod';
import type { AgentActor } from '../models/agent.model';
import { ApiError } from '../middleware/error.middleware';
/** Rechaza entradas desconocidas sin registrar datos personales. */
export function input<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError('Datos invalidos. Revisa los campos y sus limites.', 400);
  return result.data;
}
/** Aplica autorizacion tambien cuando el servicio se llama desde un agente. */
export function adminOnly(actor: AgentActor): void {
  if (actor.rol !== 'admin') throw new ApiError('Esta operacion requiere administracion.', 403);
}
