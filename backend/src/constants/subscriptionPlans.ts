/**
 * @archivo subscriptionPlans.ts
 * @descripcion Definición de los planes de suscripción SaaS de OfiAI.
 * Incluye límites, precios y características por plan y por país.
 */
export const PLANES_SUSCRIPCION = {
  GRATUITO: {
    id: 'gratuito',
    nombre: 'Gratuito',
    precioMensual: 0,
    limitesEmpresa: {
      trabajosPublicados: 1,
      perfilesVisibles: 5,
      consultasIA: 5,
    },
    limitesProfesional: {
      propuestasEnviadas: -1,
      consultasIA: 5,
    },
  },
  PROFESIONAL: {
    id: 'profesional',
    nombre: 'Profesional gratuito',
    precioMensual: 0,
    limitesEmpresa: {
      trabajosPublicados: 5,
      perfilesVisibles: 40,
      consultasIA: 40,
    },
    limitesProfesional: {
      propuestasEnviadas: -1,
      consultasIA: 50,
    },
  },
  EMPRESA: {
    id: 'empresa',
    nombre: 'Empresa',
    precioMensual: 39900,
    limitesEmpresa: {
      trabajosPublicados: -1,
      perfilesVisibles: -1,
      consultasIA: 200,
    },
    limitesProfesional: {
      propuestasEnviadas: -1,
      consultasIA: 100,
    },
  },
} as const;

export const PLANES_POR_ID = {
  gratuito: PLANES_SUSCRIPCION.GRATUITO,
  profesional: PLANES_SUSCRIPCION.PROFESIONAL,
  empresa: PLANES_SUSCRIPCION.EMPRESA,
} as const;

export type IdPlanSuscripcion = keyof typeof PLANES_POR_ID;

/**
 * Obtiene la configuración de un plan por su identificador público.
 */
export const obtenerPlanSuscripcion = (plan: IdPlanSuscripcion) => PLANES_POR_ID[plan];
