# Pricing Agent: informe tecnico

Fecha de verificacion: 2026-09-23.

## Entrega

Flujo conectado: Intake publica el Job con confirmacion -> Matching -> Pricing.
El worker de Pricing se ejecuta despues de guardar Matching, sin notificar, contratar ni cobrar.
Una falla de Pricing no deshace Matching ni el Job confirmado.

Pricing cuenta con agente, herramientas deterministas, prompt, servicio, repositorio,
controller, rutas, contratos, persistencia Firestore, auditoria, eventos y pantallas web/Expo.
Se reutiliza el cliente Gemini existente. No se reorganizaron carpetas ni se agregaron dependencias.

La prueba real de Gemini no produjo analisis semantico; el fallback si fue verificado.
Esta entrega NO acredita un despliegue productivo ni una validacion completa del proveedor.

## Metodo de calculo

1. La empresa confirma alcance comparable, moneda, unidad, cantidad y cobertura de materiales/impuestos.
2. Se consultan presupuestos de ese Job, propuestas propias existentes y propuestas aceptadas de trabajos completados de la misma empresa.
3. Historicos requieren categoria, ciudad/pais, modalidad, alcance, unidad, moneda y cobertura compatibles, y antiguedad maxima de 90 dias. No se confunden con pagos o costos finales.
4. Como fuente alternativa se consultan tarifas horarias de candidatos reales del Matching vigente, activos y compatibles. Se respeta la experiencia minima indicada.
5. Las tarifas necesitan moneda, cobertura declarada y fecha de confirmacion. No se infiere cobertura desde una tarifa legacy.
6. Prioridad de referencias: presupuestos actuales, historicos propios, tarifas horarias. No se mezclan fuentes para inflar la muestra.
7. Cantidades se normalizan proporcionalmente por unidad; se advierte que no incluye costos fijos ni descuentos por volumen.
8. IQR excluye extremos solo con cinco o mas referencias. Rango: percentiles 10/90; central: mediana. Con una referencia se muestra el mismo importe en ambos extremos y confianza baja.
9. Comparacion de presupuestos usa al menos tres pares independientes del presupuesto evaluado. Ratios menores a 0.5 o mayores a 2 generan aviso de importe atipico, nunca acusacion de fraude.
10. Materiales separados solo se suman si la empresa declara su costo y estan excluidos en las referencias. No se duplican materiales incluidos. No se inventan impuestos, recargos, FX ni inflacion.
11. Confianza heuristica, no probabilidad calibrada: depende de fuente, cantidad, extrapolacion, materiales desconocidos y urgencia.
12. Sin evidencia compatible: rango null, estado insufficient_data y lista de informacion faltante.

Los pesos/umbrales y TTL estan centralizados en constants/pricing.ts.
El presupuesto deseado de la empresa nunca se utiliza como evidencia de mercado ni se sobrescribe.

## API

Todas las rutas nuevas requieren Firebase Auth, rol empresa y ownership real del Job.
Prefijo: /api/v1.

| Metodo | Ruta | Resultado |
| --- | --- | --- |
| GET | /jobs/:id/pricing | Snapshot, estimacion vigente, presupuestos, historial y siguiente paso |
| POST | /jobs/:id/pricing | Calcula o reutiliza cache; body {} |
| PUT | /jobs/:id/pricing/inputs | Guarda { revision, inputs } con control optimista |
| POST | /jobs/:id/pricing/quotes | Registra { revision, quote }, ID idempotente |

Entradas estrictas Zod: unidades hour/m2/unit/job, cantidad positiva, monedas de tres letras,
materiales/impuestos included/excluded/unknown, valores finitos y vencimientos validos.
No se acepta companyId, precios calculados ni confianza del cliente.
Las mutaciones sobre Jobs cerrados se rechazan. Los errores internos no se entregan al frontend.
Se reutiliza limitadorIA para escrituras. GET nunca llama a Gemini.

El endpoint anterior POST /ai/pricing permanece disponible. Categoria y complejidad solas
ahora devuelven informacion_insuficiente, importes null y confianza 0, en lugar de importes USD
renombrados como otra moneda. Los consumidores deben tratar null como desconocido y pasar al
nuevo flujo asociado a un Job.

## Firestore

No se migro la base de datos. Proyecto verificado: ofiai-2f357, base nombrada default.

- jobs/{jobId}/pricing/context: inputs, revision y contador de presupuestos.
- jobs/{jobId}/pricing/current: estado processing/completed/failed, lease, fingerprint y resultado vigente.
- jobs/{jobId}/pricing_quotes/{quoteId}: presupuesto declarado por empresa; no representa una oferta emitida por el profesional.
- jobs/{jobId}/pricing_estimates/{runId}: version inmutable con resultado, referencias utilizadas, inputs, revision y snapshot acotado del Job.
- jobs/{jobId}/pricing_audit/{eventId}: cambios de inputs y altas de presupuestos, fecha y revision.
- analytics_events: pricing_started, pricing_completed, pricing_failed, pricing_fallback_used, pricing_inputs_updated, pricing_quote_recorded.

Eventos contienen duracion, cantidad de referencias, confianza, estado y uso semantico/fallback.
No contienen prompts, tokens ni datos personales innecesarios.

Lecturas acotadas a 40 presupuestos declarados, 100 propuestas propias y 20 candidatos.
Si se limita el historico se informa. Historial visible: diez versiones recientes.
TTL: 30 minutos; lease: 60 segundos. Cambios de Job, inputs, presupuestos, tarifas o configuracion
invalidan por fingerprint. Se vuelve a comprobar antes del commit. No hay Gemini dentro de una transaccion.
Las reglas locales niegan acceso SDK directo a todas las subcolecciones nuevas.
No se desplegaron ni verificaron estas reglas con Emulator en esta entrega; Admin SDK no prueba Rules.

Campos profesionales opcionales: tarifaHoraMateriales, tarifaHoraImpuestos, tarifaHoraActualizadaAt.
Se pueden confirmar mediante la API de perfiles existente; fecha gestionada por servidor.
El formulario general de perfil no se amplio en esta fase. Tarifas antiguas sin condiciones no son utilizables como evidencia.
Proposal admite pricingTerms opcional con alcance, unidad, cantidad, cobertura y vencimiento.
Propuestas anteriores sin esos datos se conservan, pero no se usan para calcular importes.

## Gemini y entorno

Prompt versionado PRICING_PROMPT_VERSION = 1.0.0.
Gemini recibe datos del trabajo sin contactos, alcance y evidencia con IDs anonimizados.
Devuelve summary, evidenceIds, questions y cautions mediante JSON estructurado validado por Zod.
No puede modificar rango, referencias, confianza ni moneda. IDs desconocidos, respuestas invalidas,
timeout, limite o proveedor no disponible mantienen el calculo determinista.
No se llama al proveedor sin inputs y rango sustentado. No se guardan prompts completos.

Variables nuevas, solo backend:

- GEMINI_PRICING_MODEL=gemini-3.6-flash
- GEMINI_PRICING_ENABLED=true

Se reutiliza GEMINI_API_KEY, sin crear ni exponer otra clave. Los valores anteriores son defaults
y estan documentados en backend/.env.example; no se modificaron secretos del .env.

## Web y movil

Web: /dashboard/company/jobs/:jobId/pricing, desde Ver estimacion de precio en Matching.
Movil: JobPricingScreen, desde el mismo flujo de candidatos.

Incluyen rango, confianza, referencias, razones, advertencias, inputs editables, presupuestos,
comparacion, historial, loading/error/insufficient_data y acceso a seleccion de profesional.
Formularios moviles en modal con teclado, scroll, Back y estados deshabilitados.
No hay peticiones directas a Gemini ni precios calculados en React.
Se cancela al desmontar/cambiar de cuenta y al perder foco en Expo.

## Verificacion

| Verificacion | Resultado |
| --- | --- |
| Backend build y lint | OK |
| Backend suite completa | 130 tests, 15 suites, OK |
| Pricing unit/API despues del ajuste final | 39 tests, OK |
| Web build y lint | OK |
| Web tests | 49 tests, 7 archivos, OK |
| Mobile typecheck | OK |
| Mobile tests | 12 tests, 3 suites, OK |
| Expo export Android | OK con Node 20 compatible con Expo 50 existente |
| Navegador aislado con API/Firebase reales | 1440, 768, 390 y 320 px: sin overflow ni errores JS |
| Cambio de alcance en navegador | Invalida precio previo y vuelve a insufficient_data |
| Clave Gemini en artefactos web/Android | Ausente en los 12 archivos inspeccionados |
| Telefono fisico | Pendiente: adb devices no muestra equipos |

Total: 191 tests; 47 agregados en esta entrega. No se actualizo Expo ni se alteraron las
renovaciones mensuales existentes.

Prueba real: un Job temporal en borrador de la empresa demo, un candidato real del catalogo,
un presupuesto SINTETICO de 120000 ARS y terminos explicitos. Se verificaron rango, fallback,
cache, dos versiones iniciales y auditoria, sin modificar el presupuesto original.
Despues se edito el alcance desde el navegador y se verifico su invalidacion.
Se eliminaron el Job temporal, sus 11 documentos hijos y sus 13 eventos. No se crearon
profesionales falsos ni se modificaron usuarios o perfiles existentes.

Estado del catalogo consultado: un profesional sin tarifas; cero trabajos completados;
cero propuestas. Para obtener rangos reales deben cargarse referencias reales.
Las respuestas semanticas validas se probaron con dobles del proveedor, no con Gemini disponible en vivo.

## Como probar

1. Iniciar backend y web con sus configuraciones Firebase existentes.
2. Entrar como empresa y abrir un Job propio.
3. Abrir Ver candidatos y luego Ver estimacion de precio.
4. Confirmar alcance/unidad/cantidad/moneda/materiales/impuestos.
5. Registrar un presupuesto realmente recibido, con alcance y cobertura comparables.
6. Revisar el rango, advertencias y confianza. Cargar mas presupuestos para comparar.
7. Cambiar la cantidad o alcance y comprobar que se recalcula; un alcance incompatible no reutiliza el precio anterior.
8. Abrir la misma solicitud en Expo para recuperar el mismo estado del servidor.
9. Seleccionar un candidato: se prepara la siguiente fase, sin contratar ni cobrar.

La web local queda en http://localhost:5173/jobs. El scheduler esta desactivado solamente
en el proceso local de preview, no en el .env ni en la logica de renovaciones.

## Siguientes fases

Se agregaron contratos tipados, no implementaciones ficticias:

- CoordinatorState incluye el workflow solicitado desde MATCHED hasta COMPLETED.
- CoordinatorHandoff referencia Job, corrida Matching, estimacion inmutable y profesional seleccionado.
- Coordinator debera revalidar ownership, vigencia, seleccion y consentimiento antes de cada accion.
- SubscriptionBillingProvider prepara verificacion backend y notificaciones idempotentes para Mercado Pago, Google Play y Apple.
- Tipos de planes empresa FREE/BUSINESS/BUSINESS_PRO/ENTERPRISE y profesional FREE/PRO/PRO_PLUS, sin migrar los planes actuales.
- TransactionFeePolicy separa comisiones de la estimacion del trabajo y la suscripcion digital.

Pendiente: motor durable de workflow y transiciones, contacto, negociacion, agenda, contratacion,
reviews/Reputation y su alimentacion a Matching. Tambien catalogo comercial, entitlements,
limites, upgrades/downgrades, conciliacion, factura, comisiones e historial financiero completos.

Mercado Pago conserva su integracion actual. Google Play y Apple todavia NO tienen adaptadores,
productos de tienda, SDK de compra ni pruebas sandbox. Para implementarlos:
[verificacion Play Billing en backend](https://developer.android.com/google/play/billing/security),
[notificaciones Play](https://developer.android.com/google/play/billing/backend),
[API de Apple y transacciones firmadas](https://developer.apple.com/documentation/appstoreserverapi)
y [API de suscripciones Mercado Pago](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/search-preapproval/get).

## Problemas y limites

- Resolver disponibilidad/plan del proyecto Gemini y verificar respuesta real; no se cambiaron facturacion ni credenciales.
- Poblacion y calidad de evidencia insuficientes para calibrar precios o confianza con resultados reales.
- Historicos limitados: paginacion/indexacion adicional necesaria para empresas con mas de 100 referencias.
- Materiales son un costo declarado agregado; presupuestos por partidas y normalizacion semantica de alcances quedan para evolucion posterior.
- Propuestas aceptadas no equivalen a costos liquidados. No se implemento contabilidad de costos finales.
- Reglas/emulador, Cloudflare productivo, hardware movil y tiendas siguen pendientes.
- Vite mantiene avisos previos sobre __dirname en config y bundle principal cercano a 773 KB.
- Los cambios preexistentes del repositorio se conservaron; el listado siguiente es solo esta entrega.

## Archivos creados (25)

- `backend/src/ai/prompts/pricing.prompt.ts`
- `backend/src/ai/tools/pricing.tool.ts`
- `backend/src/constants/pricing.ts`
- `backend/src/controllers/pricing.controller.ts`
- `backend/src/domain/pricing/pricing.ts`
- `backend/src/events/pricing.event.ts`
- `backend/src/models/billing-provider.model.ts`
- `backend/src/models/coordinator.model.ts`
- `backend/src/models/pricing.model.ts`
- `backend/src/repositories/pricing.repository.ts`
- `backend/src/routes/pricing.routes.ts`
- `backend/src/services/pricing.service.ts`
- `backend/src/validators/pricing.validator.ts`
- `backend/tests/api/pricing.test.ts`
- `backend/tests/pricing-fixtures.ts`
- `backend/tests/unit/pricing.test.ts`
- `docs/PricingAgent.md`
- `mobile/src/lib/pricing.ts`
- `mobile/src/navigation/JobPricingScreen.test.tsx`
- `mobile/src/navigation/JobPricingScreen.tsx`
- `shared/pricing.d.ts`
- `web/src/app/JobPricingPage.test.tsx`
- `web/src/app/JobPricingPage.tsx`
- `web/src/app/pricing.css`
- `web/src/lib/api/pricing.ts`

## Archivos modificados (22)

- `README.md`
- `backend/.env.example`
- `backend/src/ai/agents/pricing.agent.ts`
- `backend/src/config/env.ts`
- `backend/src/controllers/ai.controller.ts`
- `backend/src/database/firestore/collections.ts`
- `backend/src/domain/pricing/index.ts`
- `backend/src/domain/subscriptions/index.ts`
- `backend/src/models/Professional.ts`
- `backend/src/models/Proposal.ts`
- `backend/src/routes/jobs.routes.ts`
- `backend/src/services/matching.service.ts`
- `backend/src/services/professional.service.ts`
- `backend/src/validators/professional.validator.ts`
- `backend/src/workers/pricing.worker.ts`
- `mobile/src/navigation/JobMatchesScreen.tsx`
- `mobile/src/navigation/index.tsx`
- `mobile/src/types/index.ts`
- `shared/firestore.rules`
- `web/src/app/JobMatchesPage.tsx`
- `web/src/app/Router.tsx`
- `web/src/layouts/DashboardLayout.tsx`
