# Monetizacion OfiAI: entrega comercial
Fecha: 26/09/2026. Alcance: suscripciones y facturacion. Desarrollo de agentes en pausa.

## Precios
| Audiencia | Plan | USD/mes | Cuota mensual operativa |
| --- | --- | ---: | --- |
| Empresa | FREE | 0 | 1 trabajo |
| Empresa | BUSINESS | 35 | 10 trabajos |
| Empresa | BUSINESS PRO | 79 | 40 trabajos |
| Empresa | ENTERPRISE | 149 | Sin limite de trabajos |
| Profesional | FREE | 0 | 3 propuestas |
| Profesional | PRO | 35 | 50 propuestas |
| Profesional | PRO+ | 59 | Sin limite de propuestas |

Los precios pagos parten de USD35, segun lo solicitado. Los escalones superiores y limites iniciales son configurables.
Los IDs existentes gratuito/profesional/empresa se conservan. Los contratos anteriores mantienen precio y limites guardados: no se les modifica el importe en Mercado Pago.
USD es la referencia comercial. Nuevos checkouts argentinos se cobran en ARS usando BILLING_USD_TO_ARS configurado por el negocio.
No se consulta ni inventa un tipo de cambio. Sin conversion, token, secreto o URL de webhook, no se ofrece un checkout pago.
El importe ARS se captura al contratar y queda fijo para ese contrato hasta un cambio explicito. No hay ajuste cambiario mensual automatico.

## Integrado
- Catalogo por audiencia con configuracion validada al iniciar el backend.
- Checkout mensual recurrente Mercado Pago: frequency=1, frequency_type=months.
- Un checkout pendiente por cuenta; bloqueo transaccional y recuperacion por external_reference tras respuestas inciertas.
- Una autorizacion de contrato no se confunde con un pago. La renovacion es automatica por Mercado Pago, sin pedir al usuario pagar manualmente cada mes.
- Webhook HMAC obligatorio. El servidor consulta la factura recurrente y el pago real; verifica importe, moneda, identidad del contrato y modo productivo.
- IDs de factura y de pago tratados como recursos diferentes.
- Pagos concurrentes/repetidos no duplican revenue ni suman meses ficticios.
- Periodos derivados de fechas verificadas del proveedor; manejo UTC y ajuste de fin de mes.
- Cancelacion de proximos debitos conservando por defecto el periodo pagado. No ejecuta reembolsos.
- Upgrade/downgrade pago programado para el siguiente ciclo; acceso cambia al confirmar el nuevo importe. Sin prorrateo ni segundo contrato.
- Downgrade a FREE cancela futuros debitos y mantiene acceso pago hasta vencimiento.
- Historial, ledger, reintegros parciales/totales y contracargos. Un reintegro total del ultimo pago retira acceso pago.
- Revenue por moneda y mes de cobro: bruto, reintegros, neto antes de gastos e impuestos y numero de pagos.
- Cuotas transaccionales de publicaciones normales/Intake y propuestas de Coordinacion. Negociar versiones de una propuesta no consume repetidamente cuota.
- Cuotas por mes calendario UTC; cambiar de plan no borra el consumo. El registro comienza con esta entrega: no se reconstruye uso historico automaticamente.
- Conciliacion paginada cada diez minutos desde el scheduler existente: cinco contratos y tres facturas recientes por contrato, lease de quince minutos y cursor persistente.
- Web: catalogo por rol, precios, consumo, pagos, cambio/cancelacion con confirmacion y revenue de administracion.
- Mobile: pantalla de planes, consumo, pagos, cancelacion con confirmacion nativa y estados loading/error.
- Calculo puro de comision en enteros, configurable en basis points, sin cargos ni ingresos inventados.
- Catalogo de productos Google Play/Apple e interfaces existentes conservadas; compras nativas deshabilitadas expresamente.

## Endpoints
Base: /api/v1/subscriptions.
- GET /plans?audience=empresa|profesional: publico, catalogo sin secretos.
- POST /checkout: autenticado, precio y titularidad determinados en servidor.
- GET /me: contrato actual y vencimiento efectivo.
- GET /history: contratos y eventos propios.
- GET /billing: NUEVO, permisos efectivos, uso, pagos y preparacion de tiendas/comision.
- GET /revenue?month=YYYY-MM: NUEVO, exclusivo de administracion.
- POST /:id/change-plan: NUEVO, body {plan}, cambio al siguiente ciclo.
- POST /fee-preview: NUEVO, body {grossMinor}, estimacion de comision sin cobro; 503 si no se definio politica.
- POST /:id/cancel: cancelarAlFinalDelPeriodo=true por defecto.
- POST /:id/renew: conciliacion con Mercado Pago; no agrega meses por solicitud del cliente.
- POST /webhooks/mercadopago: firma x-signature, x-request-id y data.id verificados.
Eventos requeridos en Mercado Pago: subscription_preapproval, subscription_authorized_payment y payment.
Las operaciones de checkout/cambio/cancelacion/conciliacion tienen limitador adicional de frecuencia.
Ningun importe, rol o estado enviado por frontend activa una suscripcion.

## Firestore
Se mantienen subscriptions y subscription_history. Colecciones nuevas:
- billing_accounts/{uid}: punteros de contrato actual/checkout pendiente y bloqueo comercial.
- billing_accounts/{uid}/billing_usage/{YYYY-MM}: consumo mensual.
- billing_accounts/{uid}/quota_operations/{operationId}: idempotencia del consumo.
- billing_payments/mp_{paymentId}: recibo canonico, importe y reintegro en centavos, moneda, periodo e IDs del proveedor.
- billing_revenue/{YYYY-MM}_{currency}: agregado de pagos confirmados.
- billing_tasks/reconciliation: cursor y lease del scheduler.
- analytics_events/mp_{paymentId}_{refund}_{status}: eventos sin tarjetas, tokens ni datos personales innecesarios.

Los clientes no escriben facturacion ni con rol admin: utilizan la API. El SDK Admin del backend aplica ownership y transacciones.
Se agregaron indices usuarioId+fechaCreacion para subscriptions y usuarioId+paidAt para billing_payments.
Hay que desplegar indices/reglas en la base real antes del lanzamiento. El emulador no demuestra que un indice este desplegado en produccion.

## Variables nuevas
Todas de backend; ninguna key o credencial nueva en web/mobile.
- BILLING_USD_TO_ARS: ARS por USD. Vacia mantiene checkout pago deshabilitado.
- BILLING_CATALOG_JSON: {} por defecto. Overrides por empresa/profesional/business_pro/enterprise/pro_plus con priceUsd y limits.
- BILLING_STORE_PRODUCTS_JSON: [] por defecto. Objetos provider (google_play|apple), plan, productId, audience.
- BILLING_TRANSACTION_FEE_BPS: vacia por defecto; 100=1%. Solo calcula, no cobra.
Se conservan MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, MERCADOPAGO_NOTIFICATION_URL y MERCADOPAGO_CURRENCY=ARS.
La allowlist CORS_ORIGINS limita tambien las URLs de retorno del checkout.
No se modificaron secretos de .env. La API local se ejecuta con scheduler deshabilitado para no lanzar procesos productivos durante esta revision.

## Verificacion
- Backend build y lint: correctos; 214 tests en 23 suites.
- Web build: correcto; 81 tests en 8 archivos.
- Mobile TypeScript: correcto; 23 tests en 6 archivos.
- SDK Firestore real contra emulador local: 9 comprobaciones sobre pagos concurrentes, Timestamp, reintegros, cuotas e idempotencia.
- Reglas en emulador: 172 comprobaciones, incluidas facturacion privada y escrituras denegadas.
- Playwright: 1440, 768, 390 y 320 px, sin overflow horizontal ni errores JavaScript; confirmar/cancelar no dispara solicitudes antes del consentimiento.
- Las capturas usan identidad y respuestas HTTP sinteticas SOLO dentro del navegador de QA. No se insertaron perfiles/pagos de prueba en Firebase real.
- No se llamo a Gemini/DeepSeek ni se ejecuto ningun cobro real. Los tests de agentes preexistentes usan dobles de proveedor.
- No se valido un APK/dispositivo fisico ni una compra de Play/App Store.
- Build web conserva advertencias de bundle grande y configuracion Vite __dirname; no son errores de compilacion.
- git diff --check: sin errores de whitespace; Git advierte conversion LF/CRLF.

## Como probar
1. Backend: npm run build y npm test -- --runInBand.
2. Web: npm run build y npm test -- --run.
3. Mobile: npm run typecheck y npm test.
4. Ingresar como empresa/profesional y abrir /subscriptions; en mobile, Perfil > Planes y facturacion.
5. Sin conversion/credenciales, visualizar precios y cuotas; comprobar que contratar planes pagos esta deshabilitado.
6. Para integrar Mercado Pago en ambiente de prueba, configurar conversion, credenciales de prueba, webhook publico HTTPS y eventos requeridos.
7. Probar autorizacion sin pago, primer pago, siguiente mes, webhook duplicado, cancelacion, upgrade/downgrade y reintegro.
8. Verificar que un usuario ajeno recibe 404 y que solo admin accede a revenue.
9. Para SDK real aislado: node backend/tests/integration/billing.firestore.cjs 127.0.0.1:8085, con el emulador previamente iniciado.
10. No lanzar pruebas de cobro contra credenciales reales como sustituto del sandbox.

## Pendientes y limites
- Completar configuracion comercial ARS y verificar el ciclo real de Mercado Pago en sandbox, incluidos cambios al siguiente debito y respuestas inciertas.
- Los checkouts ambiguos sin contrato recuperable quedan bloqueados deliberadamente; necesitan conciliacion o revision operativa, no creacion ciega de otra suscripcion.
- Recibos del ledger no son facturas fiscales. Falta emision fiscal, tratamiento de impuestos y conciliacion de comisiones/gastos del proveedor.
- Definir porcentaje y condiciones de transaction fee. Falta integrar su cobro real con contratacion/pago del trabajo y registrar liquidacion, no solo una estimacion.
- Play: productos/base plans, integracion nativa, binding de cuenta, verificacion server-side, acknowledgement, RTDN, restauracion, revocaciones y pruebas licenciadas.
- Apple: productos, StoreKit, appAccountToken, verificacion JWS/cadena de confianza, Server Notifications V2, restauracion y pruebas sandbox/TestFlight.
- El catalogo de tiendas y sus interfaces no equivalen a compra habilitada. Expo Go no es validacion de compras nativas.
- Las cuotas IA y perfiles quedan en contrato/catalogo para la fase de agentes; en esta entrega los contadores operativos cubren publicaciones y propuestas, no todo el feature gating futuro.
- Revisar cuentas legacy con contratos multiples y planificar backfill de pagos/uso antes de produccion.
- La conciliacion automatica es acotada a contratos con renovacion habilitada; backfills extensos y auditoria de contratos cerrados requieren operacion adicional.
- Despliegue Cloudflare, dominios, scheduler productivo, secretos, indices/reglas y comprobacion de proveedores siguen pendientes de despliegue real.
- En esta entrega comercial no se actualizo Expo. La revision posterior migro a SDK 54;
  ver [QA y vulnerabilidades pendientes](QA-2026-09-27.md).
- Los agentes, reputacion avanzada y el resto del roadmap no se consideran terminados por esta entrega comercial.

## Archivos creados en esta entrega
- shared/billing.d.ts
- backend/src/constants/billing.ts
- backend/src/utils/billing.ts
- backend/src/workers/billing.worker.ts
- backend/tests/unit/billing.test.ts
- backend/tests/unit/billing-worker.test.ts
- backend/tests/unit/mercadopago-billing.test.ts
- backend/tests/api/billing.test.ts
- backend/tests/integration/billing.firestore.cjs
- web/src/app/SubscriptionBillingPanel.tsx
- mobile/src/navigation/SubscriptionsScreen.tsx
- mobile/src/navigation/SubscriptionsScreen.test.tsx
- docs/Monetization.md

## Archivos modificados en esta entrega
- README.md
- backend/.env.example
- backend/src/config/env.ts
- backend/src/config/productionReadiness.ts
- backend/src/database/firestore/collections.ts
- backend/src/models/Subscription.ts
- backend/src/integrations/mercadopago/index.ts
- backend/src/repositories/subscription.repository.ts
- backend/src/repositories/jobs.repository.ts
- backend/src/repositories/intake.repository.ts
- backend/src/repositories/coordinator.repository.ts
- backend/src/services/subscription.service.ts
- backend/src/controllers/subscription.controller.ts
- backend/src/validators/subscription.validator.ts
- backend/src/routes/subscriptions.routes.ts
- backend/src/scheduler/scheduler.service.ts
- shared/contracts.ts
- shared/firestore.rules
- shared/firestore.indexes.json
- shared/coordinator.rules.test.mjs
- web/src/app/Router.tsx
- web/src/app/Router.test.tsx
- web/src/shared/types/index.ts
- mobile/src/navigation/index.tsx
- mobile/src/types/index.ts

Se conservaron cambios anteriores sin renombrar ni reorganizar modulos. La capa de agentes no se modifico en esta entrega; las cuotas se integraron en repositorios existentes.

## Fuentes tecnicas verificadas
- [Mercado Pago: webhook y validacion de origen](https://www.mercadopago.com.ar/developers/en/docs/split-payments/additional-content/your-integrations/notifications/webhooks)
- [Mercado Pago: factura recurrente authorized_payments](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-authorized-payment/get)
- [Mercado Pago: actualizar preapproval](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/update-preapproval/put)
- [Google Play: integracion con backend](https://developer.android.com/google/play/billing/backend)
- [Apple: App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [Firestore: indices](https://firebase.google.com/docs/firestore/query-data/index-overview)
