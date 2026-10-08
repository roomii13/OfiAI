/** @archivo settlements.test.ts @descripcion HTTP real con Auth y Mercado Pago aislados: sin dinero ni credenciales reales. */
import express from 'express';
import type { Server } from 'node:http';
import { createHmac } from 'node:crypto';
import { settlementRoutes } from '../../src/routes/settlement.routes';
import { protectedContractRoutes } from '../../src/routes/protected-contract.routes';
import { firestore } from '../../src/integrations/firebase/admin';
import { MemoryFirestore } from '../intake-fixtures';
import { env } from '../../src/config/env';
import { obtenerCuentaReceptoraMercadoPago,obtenerCobroTrabajoMercadoPago } from '../../src/integrations/mercadopago';
jest.mock('../../src/integrations/firebase/admin',()=>({firestore:new (jest.requireActual('../intake-fixtures').MemoryFirestore)()}));
jest.mock('../../src/config/firebase',()=>({getAuth:()=>({verifyIdToken:async(token:string)=>{
  if(!['company','professional','owner','admin'].includes(token))throw new Error('invalid');
  return{uid:token,email:token==='owner'?'romina.celis33@gmail.com':'otra.persona@example.test',email_verified:false,
    auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_second_factor:undefined}};
}})}));
jest.mock('../../src/integrations/mercadopago',()=>({...jest.requireActual('../../src/integrations/mercadopago'),obtenerCuentaReceptoraMercadoPago:jest.fn(),obtenerCobroTrabajoMercadoPago:jest.fn()}));
const db=firestore as unknown as MemoryFirestore;let server:Server;let url:string;
/** Envia HTTP con el mismo middleware utilizado por produccion. */
async function request(path:string,token='owner',method='GET',body?:unknown,extra:Record<string,string>={}) {
  const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return{status:response.status,body:await response.json() as {datos:unknown}};
}
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/settlements',settlementRoutes);app.use('/jobs/:id/contract',protectedContractRoutes);
  await new Promise<void>(resolve=>{server=app.listen(0,resolve);});const address=server.address();if(!address||typeof address==='string')throw new Error('port');url='http://127.0.0.1:'+address.port;});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
beforeEach(async()=>{db.clear();jest.clearAllMocks();env.CONTRACT_PAYMENTS_ENABLED=false;env.MERCADOPAGO_WEBHOOK_SECRET='test-only';
  for(const [uid,rol] of [['company','empresa'],['professional','profesional'],['owner','admin'],['admin','admin']])await db.collection('users').doc(uid).set({activo:true,rol});
  await db.collection('financial_grants').doc('owner').set({uid:'owner',role:'OWNER',active:true,revision:1,permissions:[],limitsMinor:{}});
});
it('401 sin sesion y 403 para admin general, empresa y profesional',async()=>{
  expect((await request('/settlements','')).status).toBe(401);
  for(const token of ['admin','company','professional'])expect((await request('/settlements',token)).status).toBe(403);
  expect((await request('/settlements')).body.datos).toMatchObject({items:[]});
});
it('un grant OWNER para otro correo no habilita el panel ni puede suplantar el correo por parametros',async()=>{
  await db.collection('financial_grants').doc('admin').set({uid:'admin',role:'OWNER',active:true,revision:1,permissions:[],limitsMinor:{}});
  expect((await request('/settlements?email=romina.celis33%40gmail.com&emailVerificado=true','admin')).status).toBe(403);
});
it('cuenta privada propia, sin campos de autoverificacion o UID inyectado',async()=>{
  const data={holder:'Profesional de prueba',kind:'alias',account:'prueba.alias',currency:'ARS'};
  expect((await request('/settlements/account','professional','PUT',{...data,verified:true})).status).toBe(400);
  expect((await request('/settlements/account','company','PUT',data)).status).toBe(403);
  expect((await request('/settlements/account','professional','PUT',data)).status).toBe(200);
  expect((await request('/settlements/account','professional')).body.datos).toMatchObject({verified:false,version:1});
});
it('owner sin MFA ni correo verificado puede verificar cuenta, sin omitir controles de liquidacion',async()=>{
  await request('/settlements/account','professional','PUT',{holder:'Profesional de prueba',kind:'alias',account:'prueba.alias',currency:'ARS'});
  expect((await request('/settlements/accounts/professional/verify','owner','POST',{version:1,reason:'Constancia revisada.'})).status).toBe(200);
  expect((await request('/settlements/account','professional')).body.datos).toMatchObject({verified:true,version:1});
  expect((await request('/settlements/job-1/record-transfer','owner','POST',{idempotencyKey:'00000000-0000-4000-8000-000000000001',accountVersion:1,reference:'ref-12345',confirmTransferred:true})).status).toBe(403);
});
it('no acepta importes enviados para la transferencia',async()=>{
  expect((await request('/settlements/job-1/record-transfer','owner','POST',{idempotencyKey:'00000000-0000-4000-8000-000000000001',accountVersion:1,reference:'ref-12345',confirmTransferred:true,amountMinor:1})).status).toBe(400);
});
it('no genera checkout real mientras la configuracion final no esta habilitada',async()=>{
  expect((await request('/settlements/job-1/checkout','company','POST',{})).status).toBe(503);
  expect(obtenerCuentaReceptoraMercadoPago).not.toHaveBeenCalled();
});
it('webhook falsificado no consulta al proveedor ni registra un ingreso',async()=>{
  expect((await request('/settlements/webhooks/mercadopago?data.id=100','','POST',{type:'payment',data:{id:'100'}})).status).toBe(401);
  expect(obtenerCobroTrabajoMercadoPago).not.toHaveBeenCalled();
});
it('una firma valida no acepta pagos de otra cuenta receptora',async()=>{
  const ts=String(Math.floor(Date.now()/1000));const rid='request-test';const signature=createHmac('sha256','test-only').update(`id:100;request-id:${rid};ts:${ts};`).digest('hex');
  jest.mocked(obtenerCuentaReceptoraMercadoPago).mockResolvedValue('123');
  jest.mocked(obtenerCobroTrabajoMercadoPago).mockResolvedValue({id:100,status:'approved',collector_id:999,currency_id:'ARS',transaction_amount:1,external_reference:'ofiai-job:job-1',date_last_updated:new Date().toISOString()});
  expect((await request('/settlements/webhooks/mercadopago?data.id=100','','POST',{type:'payment',data:{id:'100'}},{'x-signature':`ts=${ts},v1=${signature}`,'x-request-id':rid})).status).toBe(409);
  expect(db.documents.has('contract_payment_receipts/job-1')).toBe(false);
});
