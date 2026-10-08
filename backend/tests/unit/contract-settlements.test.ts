/** @archivo contract-settlements.test.ts @descripcion Contratos y liquidaciones aislados, sin transferir ni cobrar dinero. */
import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { MemoryFirestore } from '../intake-fixtures';
import { matchingJob,matchingProfessional } from '../matching-fixtures';
import { coordinatorWorkflow,coordinatorCommand,COMPANY_UID,PROFESSIONAL_UID } from '../coordinator-fixtures';
import { pricingQuote } from '../pricing-fixtures';
import { ProtectedContractRepository } from '../../src/repositories/protected-contract.repository';
import { SettlementRepository,settlementAmounts } from '../../src/repositories/settlement.repository';
import { calculateContractCharges,decimalToMinor,bpsAmount } from '../../src/utils/contract-money';
import { defaultContractPolicy } from '../../src/constants/protected-payments';
import { contractCommandSchema } from '../../src/validators/protected-contract.validator';
import { transitionProtectedWork } from '../../src/domain/jobs/protected-contract';
import type { FinancialActor,StoredProtectedContract } from '../../src/models/protected-contract.model';
jest.mock('../../src/integrations/firebase/admin',()=>({ firestore:new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
const db=new MemoryFirestore();const repo=new ProtectedContractRepository(db as unknown as Firestore);const ledger=new SettlementRepository(db as unknown as Firestore);
const company:FinancialActor={uid:COMPANY_UID,rol:'empresa'};const pro:FinancialActor={uid:PROFESSIONAL_UID,rol:'profesional'};
/** OWNER de prueba con sesion reciente, sin correo verificado ni segundo factor. */
function owner():FinancialActor{return{uid:'owner',rol:'admin',email:'romina.celis33@gmail.com',emailVerificado:false,secondFactor:false,authTime:Math.floor(Date.now()/1000)};}
/** Crea unicamente fixtures locales. */
async function seed():Promise<StoredProtectedContract>{
  db.clear();const job=matchingJob();const p=matchingProfessional();
  await db.collection('jobs').doc(job.id).set({...job});
  await db.collection('companies').doc(job.empresaId).set({usuarioId:COMPANY_UID,activo:true});
  await db.collection('professionals').doc(p.id).set({...p,usuarioId:PROFESSIONAL_UID});
  for(const actor of [company,pro,owner(),{uid:'admin',rol:'admin'}])await db.collection('users').doc(actor.uid).set({activo:true,rol:actor.rol,nombre:'Usuario de prueba'});
  await db.collection('financial_grants').doc('owner').set({uid:'owner',role:'OWNER',active:true,revision:1,permissions:[],limitsMinor:{}});
  await db.collection('jobs').doc(job.id).collection('coordinator').doc('current').set({...coordinatorWorkflow({state:'CONFIRMED',offer:{quote:pricingQuote(0,{amount:100000}),proposedBy:'profesional',accepted:true}})});
  return repo.prepare(job.id,company);
}
beforeEach(async()=>{await seed();});
it('suma el 10% y estima acreditacion inmediata sin quitarlo del profesional',()=>{
  expect(calculateContractCharges(10000000,'plomeria',defaultContractPolicy('ARS'))).toMatchObject({
    professionalMinor:10000000,commissionMinor:1000000,processingMinor:748898,taxMinor:157269,
    clientTotalMinor:11906167,platformNetEstimatedMinor:1000000,professionalNetEstimatedMinor:10000000,chargesVerified:false});
});
it('no aplica las tarifas argentinas a otras monedas ni las marca como verificadas',()=>{
  expect(defaultContractPolicy('ARS')).toMatchObject({processorBps:629,processorTaxBps:2100,providerChargesVerified:false});
  expect(defaultContractPolicy('USD')).toMatchObject({processorBps:0,processorTaxBps:0,providerChargesVerified:false});
});
it('usa enteros y soporta monedas sin centavos',()=>{
  expect(decimalToMinor(0.29,2)).toBe(29);expect(decimalToMinor(100,0)).toBe(100);
  expect(()=>decimalToMinor(1.01,0)).toThrow();expect(()=>decimalToMinor(Number.MAX_VALUE,2)).toThrow();
  expect(calculateContractCharges(101,'a',defaultContractPolicy('CLP')).commissionMinor).toBe(10);
});
it('gross-up cubre costos sobre total e impuestos sin perder el neto ni la comision',()=>{
  const policy={...defaultContractPolicy('ARS'),processorBps:500,processorFixedMinor:3500,processorTaxBps:2100,platformTaxBps:2100,withholdingBps:100};
  const b=calculateContractCharges(10000000,'a',policy);
  expect(b.clientTotalMinor).toBe(b.professionalMinor+b.commissionMinor+b.processingMinor+b.taxMinor+b.withholdingMinor);
  expect(b.processingMinor).toBe(Number(bpsAmount(BigInt(b.clientTotalMinor),500))+3500);
  expect(b.platformNetEstimatedMinor).toBe(1000000);
});
it('reglas por categoria y version no se mezclan entre monedas',()=>{
  const policy={...defaultContractPolicy('USD'),categoryBps:{electricidad:750}};
  expect(calculateContractCharges(10000,'electricidad',policy).commissionMinor).toBe(750);
  expect(calculateContractCharges(10000,'plomeria',policy).commissionMinor).toBe(1000);
});
it('rechaza estados e importes arbitrarios en comandos',()=>{
  expect(contractCommandSchema.safeParse({action:'accept_terms',idempotencyKey:randomUUID(),revision:1,termsVersion:'x',acknowledge:true,total:1}).success).toBe(false);
});
it('mantiene snapshot inmutable e idempotente al abrir expediente',async()=>{
  const c=await repo.prepare(matchingJob().id,company);expect(c.revision).toBe(1);
  const w=coordinatorWorkflow({state:'CONFIRMED',offer:{quote:pricingQuote(0,{amount:1}),proposedBy:'profesional',accepted:true}});
  await db.collection('jobs').doc(c.id).collection('coordinator').doc('current').set({...w});
  await expect(repo.prepare(c.id,company)).rejects.toThrow('inmutable');
});
it('el cambio al 10% no modifica un acuerdo anterior aceptado al 5%',async()=>{
  const oldPolicy={...defaultContractPolicy('ARS'),version:'historical-5pct',commissionBps:500,providerChargesVerified:true};
  await db.collection('contract_policies').doc('ARS').set(oldPolicy);
  let c=await repo.prepare(matchingJob().id,company);
  c=await repo.command(c.id,company,{action:'accept_terms',idempotencyKey:randomUUID(),revision:c.revision,termsVersion:c.breakdown.termsVersion,acknowledge:true});
  await repo.setPolicy(owner(),{...defaultContractPolicy('ARS'),version:'new-10pct',providerChargesVerified:true},'Cambio de comision autorizado.');
  const unchanged=await repo.prepare(c.id,company);
  expect(unchanged.breakdown).toEqual(c.breakdown);
  expect(unchanged.breakdown.commissionBps).toBe(500);
  expect((await repo.policy(owner(),'ARS')).commissionBps).toBe(1000);
});
it('aisla contratantes ajenos y profesionales ajenos',async()=>{
  await db.collection('users').doc('other').set({activo:true,rol:'empresa'});
  await expect(repo.read(matchingJob().id,{uid:'other',rol:'empresa'})).rejects.toMatchObject({codigoEstado:404});
});
it('solo el contratante acepta y el doble clic no duplica auditorias',async()=>{
  const initial=await repo.read(matchingJob().id,company);
  await db.collection('contract_agreements').doc(initial.id).update({breakdown:{...initial.breakdown,chargesVerified:true}});
  const c=await repo.read(matchingJob().id,company);const cmd={action:'accept_terms' as const,idempotencyKey:randomUUID(),revision:c.revision,termsVersion:c.breakdown.termsVersion,acknowledge:true as const};
  await expect(repo.command(c.id,pro,cmd)).rejects.toMatchObject({codigoEstado:403});
  const results=await Promise.all([repo.command(c.id,company,cmd),repo.command(c.id,company,cmd)]);
  expect(results.map(r=>r.revision)).toEqual([2,2]);
});
it('impide aceptar tarifas sin verificar aunque el cliente omita el control visual',async()=>{
  const c=await repo.read(matchingJob().id,company);
  await expect(repo.command(c.id,company,{action:'accept_terms',idempotencyKey:randomUUID(),revision:c.revision,termsVersion:c.breakdown.termsVersion,acknowledge:true})).rejects.toMatchObject({codigoEstado:409});
  expect((await repo.read(c.id,company)).acceptedAt).toBeNull();
});
it('aprobacion bilateral no representa pago y un reclamo bloquea completar',async()=>{
  const c=await repo.read(matchingJob().id,company);const w=coordinatorWorkflow({state:'IN_PROGRESS',offer:{quote:pricingQuote(0,{amount:100000}),proposedBy:'profesional',accepted:true}});
  const request=transitionProtectedWork(c,w,w,coordinatorCommand(w,'request_completion'));
  const both=transitionProtectedWork(request,w,{...w,state:'COMPLETED'},coordinatorCommand(w,'complete'));
  expect(both.financialState).toBe('UNPAID');expect(both.clientApprovedAt).toBeTruthy();
  const disputed=await repo.command(c.id,company,{action:'open_dispute',reason:'El trabajo no se completo.',revision:c.revision,idempotencyKey:randomUUID()});
  expect(()=>transitionProtectedWork(disputed,w,w,coordinatorCommand(w,'complete'))).toThrow('reclamo');
});
it('admin general no puede leer el panel financiero ni otorgarse permisos',async()=>{
  await expect(ledger.overview({uid:'admin',rol:'admin'})).rejects.toMatchObject({codigoEstado:403});
  await expect(repo.setGrant({uid:'admin',rol:'admin'}, {uid:'admin',active:true,permissions:['finance'],limitsMinor:{ARS:999999}},'Prueba de permisos')).rejects.toMatchObject({codigoEstado:403});
});
it.each(['romina.celis33@gmail.com','rom-cel@live.com.ar'])('admite OWNER solo con correo autorizado %s y grant activo',async(email)=>{
  await expect(ledger.overview({...owner(),email})).resolves.toHaveProperty('items');
});
it.each([{email:'otra.persona@example.test'},{email:undefined}])('rechaza OWNER con identidad incompatible aunque exista un grant %j',async(patch)=>{
  await expect(ledger.overview({...owner(),...patch})).rejects.toMatchObject({codigoEstado:403});
});
it('un correo propietario no concede OWNER sin un grant autorizado',async()=>{
  await expect(ledger.overview({...owner(),uid:'admin'})).rejects.toMatchObject({codigoEstado:403});
});
it.each(['romina.celis33@gmail.com','rom-cel@live.com.ar'])('OWNER %s verifica destinos sin exigir correo verificado ni MFA',async(email)=>{
  await ledger.saveAccount(pro,{holder:'Profesional de prueba',account:'prueba.alias',kind:'alias',currency:'ARS'});
  await ledger.verifyAccount({...owner(),email},pro.uid,1,'Titularidad revisada');expect((await ledger.ownAccount(pro))?.verified).toBe(true);
  await ledger.saveAccount(pro,{holder:'Profesional de prueba',account:'otra.cuenta',kind:'alias',currency:'ARS'});
  expect((await ledger.ownAccount(pro))?.verified).toBe(false);
});
it.each([undefined,Number.NaN,Number.POSITIVE_INFINITY,0])('OWNER no puede operar sin fecha de autenticacion valida: %s',async(authTime)=>{
  await expect(ledger.verifyAccount({...owner(),authTime},pro.uid,1,'Titularidad revisada')).rejects.toMatchObject({codigoEstado:403});
});
it.each([-601,60])('OWNER debe volver a ingresar si la fecha de autenticacion tiene desfase %s',async(offset)=>{
  await expect(ledger.verifyAccount({...owner(),authTime:Math.floor(Date.now()/1000)+offset},pro.uid,1,'Titularidad revisada')).rejects.toMatchObject({codigoEstado:403});
});
it('no extiende la exencion de segundo factor a administradores delegados',async()=>{
  let c=await repo.read(matchingJob().id,company);
  c=await repo.command(c.id,company,{action:'open_dispute',reason:'La tarea quedo incompleta.',revision:c.revision,idempotencyKey:randomUUID()});
  await db.collection('financial_grants').doc('admin').set({uid:'admin',role:'DISPUTE_ADMIN',active:true,revision:1,permissions:['view','propose'],limitsMinor:{}});
  await db.collection('contract_agreements').doc(c.id).update({assignedUid:'admin'});
  const actor={...owner(),uid:'admin'};
  const command={action:'propose' as const,kind:'MORE_INFORMATION' as const,refundMinor:0,reason:'Se requiere informacion adicional.',revision:c.revision,idempotencyKey:randomUUID()};
  await expect(repo.command(c.id,actor,command)).rejects.toMatchObject({codigoEstado:403});
  await expect(repo.command(c.id,{...actor,secondFactor:true},command)).resolves.toHaveProperty('dispute.state','PROPOSED');
});
/** Prepara un cobro simulado local y aprobaciones, sin consultar Mercado Pago. */
async function ready():Promise<StoredProtectedContract>{
  const c=await repo.read(matchingJob().id,company);
  await db.collection('contract_agreements').doc(c.id).update({professionalCompletedAt:new Date().toISOString(),clientApprovedAt:new Date().toISOString()});
  await ledger.saveAccount(pro,{holder:'Profesional de prueba',account:'prueba.alias',kind:'alias',currency:'ARS'});
  await ledger.verifyAccount(owner(),pro.uid,1,'Verificacion sintetica');
  await db.collection('contract_checkouts').doc(c.id).set({collectorId:'123',status:'ready'});
  await ledger.applyPayment({id:'101',contractId:c.id,status:'approved',currency:'ARS',amountMinor:c.breakdown.clientTotalMinor,netReceivedMinor:c.breakdown.professionalMinor+c.breakdown.commissionMinor,refundedMinor:0,updatedAt:new Date().toISOString(),verifiedAt:new Date().toISOString()},'123');
  return repo.read(c.id,company);
}
it('mantiene el 10% separado en la orden manual y evita doble registro concurrente',async()=>{
  const c=await ready();const rows=await ledger.overview(owner());expect(rows.items[0]).toMatchObject({readyToTransfer:true,professionalTransferMinor:10000000,ofiaiFeeMinor:1000000,ofiaiNetActualMinor:1000000});
  const key=randomUUID();await Promise.all([ledger.recordTransfer(owner(),c.id,key,1,'comprobante-123'),ledger.recordTransfer(owner(),c.id,key,1,'comprobante-123')]);
  const done=(await ledger.overview(owner())).items[0]!;expect(done.transfer?.amountMinor).toBe(10000000);expect(done.ofiaiFeeMinor).toBe(1000000);
  await expect(ledger.recordTransfer(owner(),c.id,randomUUID(),1,'otro-comprobante')).rejects.toMatchObject({codigoEstado:409});
});
it('no descuenta costos imprevistos del profesional ni de la comision',async()=>{
  const c=await ready();await db.collection('contract_payment_receipts').doc(c.id).update({netReceivedMinor:10100000});
  const row=(await ledger.overview(owner())).items[0]!;expect(row.shortageMinor).toBe(900000);expect(row.readyToTransfer).toBe(false);
  await expect(ledger.recordTransfer(owner(),c.id,randomUUID(),1,'comprobante-999')).rejects.toMatchObject({codigoEstado:409});
});
it('revocacion OWNER efectiva en cada operacion',async()=>{
  const c=await ready();await db.collection('financial_grants').doc('owner').update({active:false,revision:2});
  await expect(ledger.recordTransfer(owner(),c.id,randomUUID(),1,'comprobante-123')).rejects.toMatchObject({codigoEstado:403});
});
it('ignora notificaciones anteriores y duplicadas sin perder contracargos',async()=>{
  const c=await ready();const p=(await db.collection('contract_payment_receipts').doc(c.id).get()).data()!;
  const chargeback={...p,status:'charged_back',updatedAt:new Date(Date.parse(String(p.updatedAt))+1000).toISOString()} as Parameters<SettlementRepository['applyPayment']>[0];
  await ledger.applyPayment(chargeback,'123');await ledger.applyPayment(p as unknown as typeof chargeback,'123');
  expect((await ledger.overview(owner())).items[0]?.paymentStatus).toBe('charged_back');
});
it('cobros aprobados duplicados requieren revision y nunca duplican el importe profesional',async()=>{
  const c=await ready();const p=(await db.collection('contract_payment_receipts').doc(c.id).get()).data()!;
  await ledger.applyPayment({...p,id:'102'} as Parameters<SettlementRepository['applyPayment']>[0],'123');
  expect((await ledger.overview(owner())).items[0]).toMatchObject({readyToTransfer:false,status:'REVIEW',professionalTransferMinor:10000000});
});
it('reembolso parcial no aparece como saldo libre a transferir',async()=>{
  const c=await ready();const p=(await db.collection('contract_payment_receipts').doc(c.id).get()).data()!;
  await ledger.applyPayment({...p,refundedMinor:1000,updatedAt:new Date(Date.parse(String(p.updatedAt))+1000).toISOString()} as Parameters<SettlementRepository['applyPayment']>[0],'123');
  expect((await ledger.overview(owner())).items[0]?.readyToTransfer).toBe(false);
});
it('resoluciones OWNER mantienen permiso, sesion reciente y aprobacion independiente',async()=>{
  let c=await repo.read(matchingJob().id,company);
  c=await repo.command(c.id,company,{action:'open_dispute',reason:'La tarea quedo incompleta.',revision:c.revision,idempotencyKey:randomUUID()});
  c=await repo.command(c.id,owner(),{action:'propose',kind:'FULL_REFUND',refundMinor:c.breakdown.clientTotalMinor,reason:'Revisar evidencia del reclamo.',revision:c.revision,idempotencyKey:randomUUID()});
  await expect(repo.command(c.id,owner(),{action:'approve_resolution',resolutionId:c.dispute!.resolution!.id,reason:'Revision de prueba.',revision:c.revision,idempotencyKey:randomUUID()})).rejects.toThrow('independiente');
});
it('sin datos del proveedor no inventa neto confirmado',async()=>{
  const c=await repo.read(matchingJob().id,company);expect(settlementAmounts(c,null)).toMatchObject({providerCostsActualMinor:null,ofiaiNetActualMinor:null});
});
it.each(['pending','rejected'])('un intento %s no aparece como cobrado',async(status)=>{
  const c=await ready();await db.collection('contract_payment_receipts').doc(c.id).update({status});
  expect((await ledger.overview(owner())).items[0]).toMatchObject({collectedMinor:null,netReceivedMinor:null,providerCostsActualMinor:null,ofiaiNetActualMinor:null,readyToTransfer:false});
});
