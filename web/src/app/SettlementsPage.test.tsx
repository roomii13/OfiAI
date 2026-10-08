/** @archivo SettlementsPage.test.tsx @descripcion Desglose y consentimiento del registro manual con datos sinteticos. */
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {SettlementsPage} from './SettlementsPage';
import {api} from '../lib/api/client';
import type {SettlementRow} from '../../../shared/settlements';
const resource=vi.hoisted(()=>({data:{items:[] as SettlementRow[],limit:50,hasMore:false},loading:false,error:'',reload:vi.fn()}));
vi.mock('../lib/api/resources',()=>({useApiResource:(path:string)=>path.startsWith('/resolution/policy/')?{loading:false,error:'',data:undefined,reload:vi.fn()}:resource}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'owner'}})}));
vi.mock('../layouts/DashboardLayout',()=>({DashboardLayout:({children}:{children:import('react').ReactNode})=>children}));
vi.mock('../lib/api/client',()=>({api:{post:vi.fn(),put:vi.fn()}}));
beforeEach(()=>{
  vi.clearAllMocks();resource.error='';
  resource.data.items=[{jobId:'job-test',professionalId:'pro-test',professionalName:'Profesional de prueba',professionalUserId:'pro-user',clientName:'Contratante de prueba',currency:'ARS',minorDigits:2,
    quoteMinor:10000000,commissionBps:1000,ofiaiFeeMinor:1000000,processingEstimatedMinor:748898,taxesEstimatedMinor:157269,clientTotalMinor:11906167,
    paymentId:'payment-test',paymentStatus:'approved',collectedMinor:11906167,providerCostsActualMinor:906167,netReceivedMinor:11000000,professionalTransferMinor:10000000,
    ofiaiNetEstimatedMinor:1000000,ofiaiNetActualMinor:1000000,shortageMinor:0,readyToTransfer:true,blockers:[],status:'READY',transfer:null,
    account:{holder:'Profesional de prueba',account:'alias.de.prueba',kind:'alias',currency:'ARS',version:1,verified:true,updatedAt:'2026-10-08T00:00:00Z'}}];
  vi.mocked(api.post).mockResolvedValue({exito:true});
});
afterEach(cleanup);
it('separa comision y profesional y exige consentimiento antes del registro manual',async()=>{
  render(<SettlementsPage/>);fireEvent.click(screen.getByRole('button',{name:'Ver liquidacion de Profesional de prueba'}));
  expect(screen.getByText('Comision OfiAI (10%)')).toBeTruthy();expect(screen.getByText('alias.de.prueba')).toBeTruthy();
  const save=screen.getByRole('button',{name:'Guardar registro manual'}) as HTMLButtonElement;expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Referencia del comprobante'),{target:{value:'transferencia-123'}});
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save);
  await waitFor(()=>expect(api.post).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/settlements/job-test/record-transfer',expect.objectContaining({accountVersion:1,reference:'transferencia-123',confirmTransferred:true})]);
  expect(vi.mocked(api.post).mock.calls[0]![1]).not.toHaveProperty('amountMinor');
});
it('un faltante bloquea la liquidacion y mantiene el desglose visible',()=>{
  const row=resource.data.items[0]!;row.readyToTransfer=false;row.shortageMinor=400000;row.blockers=['El neto no cubre la comision.'];
  render(<SettlementsPage/>);fireEvent.click(screen.getByRole('button',{name:'Ver liquidacion de Profesional de prueba'}));
  expect(screen.queryByRole('button',{name:'Guardar registro manual'})).toBeNull();expect(screen.getByRole('alert').textContent).toContain('No se reduce');
});
it('muestra el rechazo de autorizacion sin inventar cobros',()=>{
  resource.data.items=[];resource.error='Se requiere permiso OWNER.';render(<SettlementsPage/>);
  expect(screen.getByRole('alert').textContent).toBe('Se requiere permiso OWNER.');expect(api.post).not.toHaveBeenCalled();
});
