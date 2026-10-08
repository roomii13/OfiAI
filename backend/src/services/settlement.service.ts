/** @archivo settlement.service.ts @descripcion Cobros normales de Mercado Pago y liquidacion manual diferenciada de la comision. */
import { z } from 'zod';
import { SettlementRepository, settlementRepository } from '../repositories/settlement.repository';
import { contractIdSchema } from '../validators/protected-contract.validator';
import { env } from '../config/env';
import { ApiError } from '../middleware/error.middleware';
import type { FinancialActor } from '../models/protected-contract.model';
import { obtenerCuentaReceptoraMercadoPago,obtenerCobroTrabajoMercadoPago,crearCheckoutTrabajoMercadoPago,buscarCheckoutTrabajoMercadoPago,validarFirmaMercadoPago } from '../integrations/mercadopago';
import { decimalToMinor } from '../utils/contract-money';
/** Validacion tambien para llamadores internos; los importes no forman parte de los comandos. */
function valid<T>(schema:z.ZodType<T>,body:unknown):T {
  const parsed=schema.safeParse(body); if(!parsed.success) throw new ApiError('Revisa los datos de la solicitud.',400); return parsed.data;
}
export const settlementAccountSchema=z.object({ holder:z.string().trim().min(3).max(150),kind:z.enum(['cbu_cvu','alias']),
  account:z.string().trim().min(6).max(22),currency:z.literal('ARS') }).strict().refine(value=>value.kind==='cbu_cvu' ? /^\d{22}$/.test(value.account) : /^[a-zA-Z0-9.-]{6,20}$/.test(value.account),'Cuenta invalida.');
/** Nunca toma la cuenta receptora, la comision o la moneda desde el frontend. */
export class SettlementService {
  /** Adaptador repository aislable, manteniendo el cliente Mercado Pago ya existente. */
  constructor(private readonly repo:SettlementRepository=settlementRepository) {}
  /** Bandeja financiera de la propietaria. */
  async overview(actor:FinancialActor) { return this.repo.overview(actor); }
  /** Cuenta de cobro privada del profesional autenticado. */
  async account(actor:FinancialActor) { return this.repo.ownAccount(actor); }
  /** Todo cambio de destino invalida la verificacion anterior. */
  async saveAccount(actor:FinancialActor,body:unknown):Promise<void> { await this.repo.saveAccount(actor,valid(settlementAccountSchema,body)); }
  /** Registro de verificacion de titularidad efectuada por la administradora. */
  async verifyAccount(actor:FinancialActor,uid:string,body:unknown):Promise<void> {
    valid(contractIdSchema,uid); const input=valid(z.object({ version:z.number().int().positive(),reason:z.string().trim().min(10).max(500) }).strict(),body);
    await this.repo.verifyAccount(actor,uid,input.version,input.reason);
  }
  /** El importe a transferir se determina nuevamente en transaccion y excluye la comision de OfiAI. */
  async record(actor:FinancialActor,id:string,body:unknown):Promise<void> {
    valid(contractIdSchema,id); const input=valid(z.object({ idempotencyKey:z.string().uuid(),accountVersion:z.number().int().positive(),
      reference:z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9 ._/-]+$/),confirmTransferred:z.literal(true) }).strict(),body);
    await this.repo.recordTransfer(actor,id,input.idempotencyKey,input.accountVersion,input.reference);
  }
  /** No cobra al invocarse: devuelve Checkout Pro para consentimiento explicito en Mercado Pago. */
  async checkout(actor:FinancialActor,id:string):Promise<{ url:string }> {
    valid(contractIdSchema,id);
    if(!env.CONTRACT_PAYMENTS_ENABLED || !env.MERCADOPAGO_ACCESS_TOKEN || !env.MERCADOPAGO_WEBHOOK_SECRET || !env.MERCADOPAGO_NOTIFICATION_URL)
      throw new ApiError('Los cobros de contrataciones requieren validar la configuracion de produccion y los costos del proveedor.',503);
    const web=env.CORS_ORIGINS.find(origin=>origin.startsWith('https://'));
    if(!web) throw new ApiError('Falta la URL publica autorizada.',503);
    const notification=new URL(env.MERCADOPAGO_NOTIFICATION_URL);
    if(notification.protocol!=='https:') throw new ApiError('El webhook debe usar HTTPS.',503);
    notification.pathname='/api/v1/settlements/webhooks/mercadopago'; notification.search='';
    const recipient=await obtenerCuentaReceptoraMercadoPago(); const pending=await this.repo.checkout(actor,id);
    if(pending.url) return { url:pending.url };
    const preference=pending.create ? await crearCheckoutTrabajoMercadoPago({ reference:pending.reference,amountMinor:pending.amountMinor,
      returnUrl:web + '/dashboard/coordination/' + encodeURIComponent(id),notificationUrl:notification.toString() }) : await buscarCheckoutTrabajoMercadoPago(pending.reference);
    if(!preference) throw new ApiError('La creacion anterior esta pendiente de conciliacion. No se genero otro cobro.',409);
    const url=new URL(preference.init_point);
    if(String(preference.collector_id)!==recipient || preference.external_reference!==pending.reference || url.protocol!=='https:' || url.hostname!=='www.mercadopago.com.ar')
      throw new ApiError('No se pudo validar la cuenta receptora del checkout.',409);
    await this.repo.saveCheckout(id,url.toString(),String(preference.id),recipient); return { url:url.toString() };
  }
  /** Firma sobre el ID de URL, consulta canonica y conciliacion sin confiar en importes del webhook. */
  async webhook(body:unknown,signature:string|undefined,requestId:string|undefined,queryId:unknown):Promise<void> {
    const input=valid(z.object({ type:z.string(),data:z.object({ id:z.union([z.string(),z.number()]) }) }).passthrough(),body);
    if(typeof queryId!=='string' || !/^\d{1,30}$/.test(queryId) || String(input.data.id)!==queryId || !validarFirmaMercadoPago(signature,requestId,queryId))
      throw new ApiError('Firma invalida de Mercado Pago.',401);
    if(input.type!=='payment') return;
    const payment=await obtenerCobroTrabajoMercadoPago(queryId);
    if(!payment.external_reference?.startsWith('ofiai-job:')) return;
    const id=valid(contractIdSchema,payment.external_reference.slice('ofiai-job:'.length));
    const collector=await obtenerCuentaReceptoraMercadoPago();
    if(String(payment.id)!==queryId || String(payment.collector_id)!==collector || payment.currency_id!=='ARS'
      || (env.NODE_ENV==='production' && payment.live_mode!==true)) throw new ApiError('Cobro incompatible con la cuenta de OfiAI.',409);
    const amountMinor=decimalToMinor(payment.transaction_amount,2);
    const refundedMinor=decimalToMinor(payment.transaction_amount_refunded ?? 0,2);
    const net=payment.transaction_details?.net_received_amount;
    const netReceivedMinor=net==null ? null : decimalToMinor(net,2);
    if(refundedMinor>amountMinor || (netReceivedMinor!==null && netReceivedMinor>amountMinor)) throw new ApiError('Importes del proveedor inconsistentes.',409);
    await this.repo.applyPayment({ id:queryId,contractId:id,status:payment.status,currency:'ARS',amountMinor,netReceivedMinor,
      refundedMinor,updatedAt:payment.date_last_updated,verifiedAt:new Date().toISOString() },collector);
  }
}
export const settlementService=new SettlementService();
