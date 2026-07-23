/**
 * @archivo subscriptionPlans.ts
 * @descripcion Definición de los planes de suscripción SaaS de OfiAI.
 * Incluye límites, precios y características por plan y por país.
 */
export const PLANES_SUSCRIPCION = {
  BASICO: {
    id: 'basico',
    nombre: 'Básico',
    // TODO: Definir precios por país (MXN, COP, CLP, ARS, PEN)
    precioMensualUSD: 29,
    limitesEmpresa: {
      trabajosPublicados: 3,
      perfilesVisibles: 10,
      consultasIA: 20,
    },
    limitesProfesional: {
      propuestasEnviadas: 10,
      consultasIA: 10,
    },
  },
  PRO: {
    id: 'pro',
    nombre: 'Pro',
    precioMensualUSD: 79,
    limitesEmpresa: {
      trabajosPublicados: 20,
      perfilesVisibles: 100,
      consultasIA: 100,
    },
    limitesProfesional: {
      propuestasEnviadas: 50,
      consultasIA: 50,
    },
  },
  ENTERPRISE: {
    id: 'enterprise',
    nombre: 'Enterprise',
    precioMensualUSD: 199,
    limitesEmpresa: {
      trabajosPublicados: -1,   // -1 = ilimitado
      perfilesVisibles: -1,
      consultasIA: 500,
    },
    limitesProfesional: {
      propuestasEnviadas: -1,
      consultasIA: 200,
    },
  },
} as const;

// TODO: Agregar precios en moneda local por país
// TODO: Agregar planes anuales con descuento
