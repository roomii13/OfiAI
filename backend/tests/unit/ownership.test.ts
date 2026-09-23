/** @archivo ownership.test.ts @descripcion Aislamiento de Companies, Professionals y Jobs. */
import { companyService } from '../../src/services/company.service';
import { professionalService } from '../../src/services/professional.service';
import { jobsService } from '../../src/services/jobs.service';
import { companyRepository } from '../../src/repositories/company.repository';
import { professionalRepository } from '../../src/repositories/professional.repository';
import { jobsRepository } from '../../src/repositories/jobs.repository';
import type { Empresa } from '../../src/models/Company';
import type { Profesional } from '../../src/models/Professional';
import type { Trabajo } from '../../src/models/Job';

jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: { collection: jest.fn() } }));
jest.mock('../../src/repositories/company.repository', () => ({ companyRepository: { findById: jest.fn(), findByUsuarioId: jest.fn(), update: jest.fn(), softDelete: jest.fn() } }));
jest.mock('../../src/repositories/professional.repository', () => ({ professionalRepository: { findById: jest.fn(), findByUsuarioId: jest.fn(), update: jest.fn() } }));
jest.mock('../../src/repositories/jobs.repository', () => ({ jobsRepository: { findById: jest.fn(), findAll: jest.fn(), update: jest.fn() } }));
jest.mock('../../src/repositories/user.repository', () => ({ userRepository: { findById: jest.fn() } }));

beforeEach(() => {
  jest.mocked(companyRepository.findById).mockResolvedValue({ id: 'company-a', usuarioId: 'owner-a' } as Empresa);
  jest.mocked(companyRepository.findByUsuarioId).mockResolvedValue({ id: 'company-a', usuarioId: 'owner-a' } as Empresa);
  jest.mocked(professionalRepository.findById).mockResolvedValue({ id: 'pro-a', usuarioId: 'owner-a' } as Profesional);
  jest.mocked(jobsRepository.findById).mockResolvedValue({ id: 'job', empresaId: 'company-b', estado: 'borrador' } as Trabajo);
  jest.mocked(jobsRepository.findAll).mockResolvedValue([]);
});
it('impide editar y borrar una empresa ajena', async () => {
  await expect(companyService.updateCompany('company-a', 'intruder', 'empresa', {})).rejects.toMatchObject({ codigoEstado: 403 });
  await expect(companyService.deleteCompany('company-a', 'intruder', 'empresa')).rejects.toMatchObject({ codigoEstado: 403 });
  expect(companyRepository.update).not.toHaveBeenCalled();
  expect(companyRepository.softDelete).not.toHaveBeenCalled();
});
it('impide editar el perfil de otro profesional', async () => {
  await expect(professionalService.actualizarProfesional('pro-a', 'intruder', 'profesional', {})).rejects.toMatchObject({ codigoEstado: 403 });
  expect(professionalRepository.update).not.toHaveBeenCalled();
});
it('impide cancelar un trabajo de otra empresa', async () => {
  await expect(jobsService.cancelarTrabajo('job', 'owner-a', 'empresa')).rejects.toMatchObject({ codigoEstado: 403 });
  expect(jobsRepository.update).not.toHaveBeenCalled();
});
it('fija empresaId desde la identidad aunque la consulta pida otro tenant', async () => {
  await jobsService.listarVisibles('owner-a', 'empresa', { empresaId: 'company-b', limite: 20 });
  expect(jobsRepository.findAll).toHaveBeenCalledWith({ empresaId: 'company-a', limite: 20 });
});
it('no lista borradores para profesionales', async () => {
  await jobsService.listarVisibles('pro', 'profesional', { estado: 'borrador', limite: 20 });
  expect(jobsRepository.findAll).toHaveBeenCalledWith({ estado: 'publicado', limite: 20 });
});
it('rechaza la lectura directa de trabajos privados ajenos', async () => {
  jest.mocked(professionalRepository.findByUsuarioId).mockResolvedValue({ id: 'pro' } as Profesional);
  await expect(jobsService.obtenerVisible('job', 'pro', 'profesional')).rejects.toMatchObject({ codigoEstado: 403 });
});
it('permite administrar sin sustituir filtros explicitos', async () => {
  await jobsService.listarVisibles('admin', 'admin', { empresaId: 'company-b', limite: 20 });
  expect(jobsRepository.findAll).toHaveBeenCalledWith({ empresaId: 'company-b', limite: 20 });
});
