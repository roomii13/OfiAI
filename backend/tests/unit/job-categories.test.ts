/**
 * @archivo job-categories.test.ts
 * @descripcion Valida categorias sugeridas y libres sin restringirlas a un enum.
 */
import { esquemaCrearTrabajo, esquemaActualizarTrabajo } from '../../src/validators/job.validator';

const job = {
  titulo: 'Servicio especializado',
  descripcion: 'Se requiere un servicio especializado para la oficina.',
  tipoTrabajo: 'presencial',
};

it.each(['Mantenimiento', 'Electricidad', 'Plomeria', 'Tecnologia', 'Ceramica artistica'])(
  'acepta y normaliza la categoria %s', categoria => {
    expect(esquemaCrearTrabajo.parse({ ...job, categoria: `  ${categoria}  ` }).categoria).toBe(categoria);
  },
);

it.each(['', '   ', '\t\n'])('rechaza categorias vacias al crear y actualizar', categoria => {
  expect(esquemaCrearTrabajo.safeParse({ ...job, categoria }).success).toBe(false);
  expect(esquemaActualizarTrabajo.safeParse({ categoria }).success).toBe(false);
});

it('permite editar una categoria libre o conservar la existente', () => {
  expect(esquemaActualizarTrabajo.parse({ categoria: '  Restauracion de instrumentos  ' }).categoria)
    .toBe('Restauracion de instrumentos');
  expect(esquemaActualizarTrabajo.parse({ titulo: 'Trabajo actualizado' }).categoria).toBeUndefined();
});
