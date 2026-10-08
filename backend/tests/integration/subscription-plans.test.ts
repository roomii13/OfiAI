/**
 * @archivo subscription-plans.test.ts
 * @descripcion Pruebas de integración livianas para configuración comercial de suscripciones.
 */
import { obtenerPlanSuscripcion, PLANES_POR_ID } from '../../src/constants/subscriptionPlans';

describe('planes de suscripción', () => {
  it('expone planes gratuito, profesional y empresa con precios esperados', () => {
    expect(Object.keys(PLANES_POR_ID)).toEqual(['gratuito', 'profesional', 'empresa']);
    expect(obtenerPlanSuscripcion('gratuito').precioMensual).toBe(0);
    expect(obtenerPlanSuscripcion('profesional').precioMensual).toBe(0);
    expect(obtenerPlanSuscripcion('empresa').precioMensual).toBe(39900);
  });

  it('mantiene límites crecientes para uso de IA entre planes pagos', () => {
    const profesional = obtenerPlanSuscripcion('profesional');
    const empresa = obtenerPlanSuscripcion('empresa');

    expect(empresa.limitesEmpresa.consultasIA).toBeGreaterThan(profesional.limitesEmpresa.consultasIA);
    expect(empresa.limitesProfesional.propuestasEnviadas).toBe(-1);
  });
});
