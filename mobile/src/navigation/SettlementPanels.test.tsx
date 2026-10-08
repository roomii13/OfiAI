/** @archivo SettlementPanels.test.tsx @descripcion Verificacion del desglose y controles tactiles sin operaciones reales. */
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {MobileSettlementsPanel} from './SettlementPanels';
import {apiMobile} from '../lib/api';
const mockResource={data:{items:[{jobId:'job-test',professionalId:'pro',professionalName:'Profesional de prueba',professionalUserId:'pro-user',clientName:'Cliente',currency:'ARS',minorDigits:2,
  quoteMinor:10000000,commissionBps:1000,ofiaiFeeMinor:1000000,processingEstimatedMinor:748898,taxesEstimatedMinor:157269,clientTotalMinor:11906167,
  paymentId:'101',paymentStatus:'approved',collectedMinor:11906167,providerCostsActualMinor:906167,netReceivedMinor:11000000,professionalTransferMinor:10000000,ofiaiNetEstimatedMinor:1000000,
  ofiaiNetActualMinor:1000000,shortageMinor:0,readyToTransfer:true,blockers:[],status:'READY',transfer:null,
  account:{holder:'Profesional',account:'alias.prueba',kind:'alias',currency:'ARS',version:1,verified:true,updatedAt:'2026-10-08'}}]},loading:false,error:'',reload:jest.fn()};
jest.mock('../lib/resources',()=>({useMobileResource:()=>mockResource}));
jest.mock('../lib/api',()=>({apiMobile:{post:jest.fn(),put:jest.fn()}}));
jest.mock('../lib/coordinator',()=>({coordinatorId:()=> '00000000-0000-4000-8000-000000000001'}));
jest.mock('@expo/vector-icons',()=>({Ionicons:()=>null}));
jest.mock('../providers/theme',()=>({useThemeMobile:()=>({colores:{texto:'#222',borde:'#ddd',primario:'#286589',fondo:'#fff'}})}));
beforeEach(()=>{jest.clearAllMocks();(apiMobile.post as jest.Mock).mockResolvedValue({exito:true});});
it('muestra importes separados y nunca envia el neto decidido en el telefono',async()=>{
  render(<MobileSettlementsPanel/>);fireEvent.press(screen.getByRole('button',{name:'Ver cuenta y liquidacion'}));
  expect(screen.getByText('Comision OfiAI')).toBeTruthy();expect(apiMobile.post).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Referencia del comprobante'),'comprobante-123');
  fireEvent(screen.getByRole('switch'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Registrar transferencia realizada'}));
  await waitFor(()=>expect(apiMobile.post).toHaveBeenCalledTimes(1));
  expect((apiMobile.post as jest.Mock).mock.calls[0][1]).toEqual({idempotencyKey:'00000000-0000-4000-8000-000000000001',accountVersion:1,reference:'comprobante-123',confirmTransferred:true});
});
