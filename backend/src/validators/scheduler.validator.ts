/**
 * @archivo scheduler.validator.ts
 * @descripcion Esquema de validación para ejecución manual de tareas programadas.
 * Restringe nombres de tareas disponibles para administradores.
 * @modulo Validators
 */

import { z } from 'zod';

export const esquemaEjecutarTareaProgramada = z.object({
  tarea: z.enum([
    'recordatorios',
    'renovaciones',
    'limpieza_datos',
    'reintentos_notificaciones',
    'analytics_diario',
  ]),
});

export type DatosEjecutarTareaProgramada = z.infer<typeof esquemaEjecutarTareaProgramada>;
