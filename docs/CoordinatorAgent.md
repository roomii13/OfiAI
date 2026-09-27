# Coordinator Agent: integracion y estado del proyecto

Fecha de cierre tecnico: 2026-09-26. Esta entrega continua Matching y Pricing sin reorganizar el proyecto.

## Alcance entregado

Flujo: Empresa -> Intake -> Job -> Matching -> Pricing -> profesional seleccionado -> Coordinator.
El inicio es explicito: seleccionar un candidato o abrir una pantalla NO envia invitaciones ni acepta ofertas.

Coordinator dispone de agente, politica versionada, herramienta de transiciones, servicio, repositorio,
controller, rutas, worker, validadores, contratos compartidos, Firestore, eventos y pantallas web/Expo.
Se conserva crearPlan del agente anterior. No se agrego otro cliente Gemini.

La decision del siguiente paso es determinista y auditable. No necesita Gemini ni una credencial nueva.
La politica del prompt tiene version 1.0.0; no es una nueva llamada semantica al proveedor.
No hay negociacion autonoma: ambas personas deciden importes, condiciones y horarios.

## Workflow

| Estado | Evidencia necesaria / siguiente accion |
| --- | --- |
| MATCHED | Estado de origen auditado al iniciar desde una seleccion valida |
| PROFESSIONAL_SELECTED | La empresa confirma iniciar; todavia no hay contacto |
| CONTACT_PENDING | Solicitud explicita de invitacion; entrega recuperable |
| CONTACTED | Notificacion guardada en la bandeja interna, no lectura ni consentimiento |
| PROFESSIONAL_RESPONDED | Respuesta autenticada del profesional |
| QUOTE_REQUESTED | La empresa pide un presupuesto |
| QUOTE_RECEIVED | El profesional envia importe TOTAL, moneda, alcance, unidad, cantidad, cobertura y vigencia |
| COMPANY_REVIEW | La empresa marca el presupuesto para revisar |
| NEGOTIATION | Contraoferta de una parte, pendiente de aceptacion por la otra |
| SCHEDULE_PENDING | Oferta vigente aceptada por la contraparte |
| SCHEDULED | Una parte propone inicio y fin con zona horaria |
| CONFIRMED | La otra parte confirma el horario; se asigna el profesional al Job |
| IN_PROGRESS | El profesional confirma inicio desde la fecha acordada |
| COMPLETED | El profesional informa finalizacion y la empresa confirma el cierre |
| CANCELLED | Retiro antes de comenzar; motivo obligatorio y sin movimientos financieros |

Cancelar como empresa cancela el Job. Cancelar como profesional libera seleccion y asignacion y vuelve
a publicar el Job. Una nueva seleccion y Pricing vigente permiten una nueva coordinacion.
El workflow anterior, ofertas y recibos permanecen auditados.
No hay cancelacion unilateral automatizada durante IN_PROGRESS; disputas y abandono requieren la fase de soporte.

## Integraciones reales

- Matching: revalidacion transaccional de seleccion, corrida, vigencia y version del profesional.
- Pricing: estimacion vigente e inmutable, revision de contexto y seleccion esperada al iniciar.
- Pricing insuficiente: permite pedir una oferta real con reconocimiento explicito; no inventa un precio.
- Propuestas: ofertas del profesional se guardan en proposals con pricingTerms. Una contraoferta de empresa
  solo se materializa como propuesta aceptada cuando el profesional la acepta.
- Pricing detecta esas propuestas como nueva evidencia; al volver a abrir Pricing, su cache se invalida.
- Jobs: CONFIRMED -> en_revision, IN_PROGRESS -> en_progreso, COMPLETED -> completado.
- Asignacion solo despues del acuerdo bilateral. No se sobrescribe el presupuesto deseado del Job.
- Dashboard: consume el mismo Job, sus propuestas y contadores. No hay una segunda entidad de trabajo.
- Notificaciones: internas, atomicas y deduplicadas. Sin email, WhatsApp, push ni cobros nuevos.
- Scheduler: el proceso existente de reintentos recupera CONTACT_PENDING; no se tocaron renovaciones.
- Finalizacion: contadores de profesional/empresa y evento durable para reviews en el mismo commit.
- Reputation: el evento queda awaiting_reviews. No se fabrican resenas ni ratings por terminar un trabajo.

## API

Prefijo /api/v1. Firebase Auth obligatorio. Empresa y profesional solo acceden a sus acuerdos.
Admin no puede consentir por participantes.

| Metodo | Endpoint | Body |
| --- | --- | --- |
| GET | /coordinator?cursor=... | Bandeja propia, paginas de 30 |
| GET | /jobs/:id/coordinator | Estado, Job publico, siguiente paso e historial |
| POST | /jobs/:id/coordinator | { idempotencyKey: UUID, acknowledgeEstimate: true } |
| POST | /jobs/:id/coordinator/commands | { workflowId: UUID, revision, idempotencyKey: UUID, action, quote?, schedule?, note? } |

Acciones: contact, respond, request_quote, submit_quote, review_quote, counter_offer, accept_quote,
propose_schedule, confirm_schedule, start_work, request_completion, complete, cancel.
quote es PricingQuote completo. amount es total, nunca tarifa unitaria implicita.
Materiales e impuestos deben estar declarados como included o excluded antes de enviar.
schedule exige startsAt y endsAt ISO con zona, inicio futuro y fin posterior.
GET no llama a Gemini. Ningun cliente puede enviar un estado destino, companyId o actorUid.

## Seguridad y consistencia

- Zod estricto, UUIDs, parametros acotados, textos sin contactos comunes y rate limiter existente.
- Permisos comprobados en transacciones, incluida titularidad actual de perfiles.
- Revision + workflowId impiden aceptar desde pantallas antiguas, incluso tras cancelar y reiniciar.
- Idempotencia durable de inicios y comandos; repetir una clave con otro contenido se rechaza.
- Todas las ofertas, incluidas contraofertas empresariales, tienen version inmutable.
- El profesional consulta el snapshot del Job autorizado, no cambios privados posteriores a cancelacion.
- Edicion general/cancelacion de Jobs y cambio de seleccion Matching no eluden un workflow activo.
- Historial publico no expone UIDs, huellas, recibos, tokens ni payloads de auditoria internos.
- Las notificaciones y transiciones se confirman atomicamente. Los reintentos no duplican efectos.
- El limite de negociacion no bloquea request_completion ni complete.
- Nuevas subcolecciones niegan SDK cliente directo. Las propuestas ya no admiten lectura global autenticada.

La implementacion respeta las [transacciones de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions):
lecturas antes de escrituras y efectos externos fuera de callbacks que pueden repetirse.

## Firestore

Colecciones nuevas:
- jobs/{jobId}/coordinator/current: workflow actual y referencias privadas de autorizacion.
- jobs/{jobId}/coordinator_history/{workflowId_revision}: transicion, actor, tiempo, nota, comando y politica.
- jobs/{jobId}/coordinator_commands/{idempotencyKey}: recibo durable de inicio o comando.
- jobs/{jobId}/coordinator_offers/{workflowId_quoteId}: terminos inmutables de cada oferta y su autor.
- coordination_workflows/{jobId}: indice privado y paginado de bandejas.
- coordinator_outbox/{workflowId_completed}: job.completed, awaiting_reviews, para la siguiente fase.

Colecciones reutilizadas: jobs, proposals, notifications, analytics_events, companies y professionals.
Campos nuevos de Job: coordinationId y coordinationState.
No hay migracion a Neon ni datos de seed incluidos en pantallas.

## Analytics y auditoria

Eventos durables coordination_started, coordination_contact, coordination_invitation_delivered,
coordination_respond, coordination_request_quote, coordination_submit_quote, coordination_review_quote,
coordination_counter_offer, coordination_accept_quote, coordination_propose_schedule,
coordination_confirm_schedule, coordination_start_work, coordination_request_completion,
coordination_completed y coordination_cancel.
Incluyen workflowId, revision, state, durationMs y pricingInsufficient, sin importes ni textos personales.
Monitoring existente registra latencias por operacion y contadores coordinator_failed/coordinator_rejected.
No se agrego un sistema distribuido ni un dashboard nuevo de analytics avanzado.

## Web y Expo

Web: /dashboard/coordination y /dashboard/coordination/:jobId.
Accesos desde menu, Matching y Pricing. Bandeja propia para empresa y profesional.
Oferta, condiciones, fecha con zona, historial, estados de carga/error/vacio y siguiente accion.
Cada comando exige confirmacion; reintentar conserva cuerpo, revision y clave original.
Expo incorpora bandeja y JobCoordinatorScreen adaptados al telefono con formularios y teclado.
Las interfaces solo llaman al backend; no contienen claves Gemini.

## Como probar

1. Entrar como empresa y publicar un Job con Intake.
2. Abrir Matching, seleccionar un profesional y revisar/actualizar Pricing.
3. Abrir Coordinacion, reconocer el alcance de la estimacion e iniciar.
4. Confirmar Notificar al profesional.
5. Entrar con la cuenta del profesional seleccionado, abrir Coordinacion y responder.
6. Como empresa solicitar presupuesto; como profesional completar terminos y enviarlo.
7. La empresa revisa y acepta, o propone una contraoferta; la otra parte debe aceptarla.
8. Una parte propone horario futuro y la otra confirma.
9. Desde el horario acordado, el profesional confirma inicio y luego solicita cierre.
10. La empresa confirma finalizacion. Verificar Job completado, contadores e historial.
11. Repetir consultas desde Expo y comprobar que recuperan el mismo acuerdo.
12. Probar doble clic/reintento, revision vieja y acceso de otra empresa: no deben duplicar ni autorizar.

## Entorno y operacion

Coordinator no requiere nuevas variables de entorno ni dependencias de aplicacion.
La integracion posterior de DeepSeek agrega DEEPSEEK_API_KEY, DEEPSEEK_MODEL y DEEPSEEK_TIMEOUT_MS
solo al backend; la decision del workflow sigue siendo determinista y no llama a modelos.
Se reutilizan Firebase, API URLs y SCHEDULER_ENABLED.
En el preview local el scheduler queda desactivado solamente en el proceso, no en .env.
Produccion requiere un proceso/cron que ejecute reintentos; Cloudflare no fue desplegado en esta fase.
Mercado Pago conserva sus renovaciones mensuales existentes, sin cambios de credenciales o facturacion.

## Verificacion al cierre

- Backend: `npm run build`, lint y 178/178 tests en 19 suites. Las dos pruebas que importaban Firebase
  Auth sin necesitarlo aislan ese SDK en Jest; el fallo anterior provenia de `jose` ESM en Jest 29.
- Web: `npm run build` y 78/78 tests en 8 archivos. Sigue la advertencia de bundle de 797 kB
  y la advertencia de `__dirname` en la configuracion de Vite.
- Mobile: `npm run typecheck`, 20/20 tests en 5 archivos y `expo export --platform android`
  correctos. El export produce bundle Android, no APK ni prueba en dispositivo.
- Firestore: 88 comprobaciones de rules en Emulator y flujo Admin SDK completo sobre Emulator,
  incluido reintento, privacidad tras cancelacion y evento de cierre. No se desplegaron rules.
- Browser: vistas Coordinator a 1440, 768, 390 y 320 px con fixture HTTP y auth demo; sin
  errores de consola ni desbordes. No se probo el flujo con Gemini/Firestore reales en navegador.
- `git diff --check` sin errores de whitespace. No se hicieron escrituras de prueba en Firestore
  de produccion, despliegues Cloudflare, cobros ni notificaciones externas.

### Archivos creados

- Backend: `src/ai/prompts/coordinator.prompt.ts`, `src/ai/tools/coordinator.tool.ts`,
  `src/controllers/coordinator.controller.ts`, `src/events/coordinator.event.ts`,
  `src/repositories/coordinator.repository.ts`, `src/routes/coordinator.routes.ts`,
  `src/services/coordinator.service.ts`, `src/validators/coordinator.validator.ts`,
  `src/workers/coordinator.worker.ts`, `tests/api/coordinator.test.ts`, `tests/coordinator-fixtures.ts`,
  `tests/integration/coordinator.firestore.cjs`, `tests/unit/coordinator.test.ts`,
  `src/integrations/deepseek.client.ts`, `tests/unit/deepseek-fallback.test.ts`,
  `tests/unit/ai-chat-providers.test.ts`.
- Web: `src/app/CoordinatorForms.tsx`, `src/app/CoordinatorPage.tsx`,
  `src/app/CoordinatorPage.test.tsx`, `src/app/coordinator.css`,
  `src/app/coordinatorPresentation.ts`, `src/lib/api/coordinator.ts`.
- Mobile: `src/lib/coordinator.ts`, `src/lib/coordinatorForms.ts`,
  `src/lib/coordinatorForms.test.ts`, `src/lib/coordinatorPresentation.ts`,
  `src/navigation/CoordinatorActionSheet.tsx`, `src/navigation/CoordinatorScreen.tsx`,
  `src/navigation/CoordinatorTerms.tsx`, `src/navigation/CoordinatorUi.tsx`,
  `src/navigation/JobCoordinatorScreen.tsx`, `src/navigation/JobCoordinatorScreen.test.tsx`.
- Shared/documentacion: `shared/coordinator.d.ts`, `shared/coordinator.rules.test.mjs`,
  `shared/firebase-emulator.json`, `docs/CoordinatorAgent.md`.

### Archivos modificados

- Backend: `src/ai/agents/coordinator.agent.ts`, `src/database/firestore/collections.ts`,
  `src/models/Job.ts`, `src/models/coordinator.model.ts`, `src/repositories/jobs.repository.ts`,
  `src/repositories/matching.repository.ts`, `src/routes/index.ts`, `src/routes/jobs.routes.ts`,
  `src/scheduler/scheduler.service.ts`, `tests/intake-fixtures.ts`,
  `tests/api/health.test.ts`, `tests/unit/firebase-config.test.ts`,
  `src/ai/agents/intake.agent.ts`, `src/ai/agents/matching.agent.ts`,
  `src/ai/agents/pricing.agent.ts`, `src/config/env.ts`, `src/config/productionReadiness.ts`,
  `src/integrations/gemini/gemini.client.ts`, `src/services/ai.service.ts`,
  `tests/unit/matching-agent.test.ts`, `.env.example`.
- Web: `src/app/JobMatchesPage.tsx`, `src/app/JobPricingPage.tsx`,
  `src/app/Router.tsx`,
  `src/layouts/DashboardLayout.tsx`, `src/lib/gemini/index.ts`.
- Mobile: `jest.config.cjs`, `src/navigation/JobMatchesScreen.tsx`,
  `src/navigation/JobPricingScreen.tsx`, `src/navigation/index.tsx`, `src/types/index.ts`.
- Shared/documentacion: `shared/firestore.rules`, `README.md`, `API.md`, `AIAgents.md`,
  `Database.md`, `Deployment.md`, `Roadmap.md`.

`backend/.env` se actualizo solo localmente con la clave facilitada, permanece ignorado por Git y
no forma parte del inventario versionado. El tracking ID no se usa como credencial.

## Pendientes del producto

1. Reviews verificadas por Job/participantes, Reputation completo y feedback a Matching.
2. Pricing avanzado: evidencia real suficiente, calibracion, presupuestos por partidas y costos finales.
3. Coordinator avanzado: contacto externo consentido, SLA, recordatorios deduplicados, conflictos de agenda,
   no-show, disputas, cambios posteriores al inicio y negociacion asistida. No implementar consentimientos autonomos.
4. Monetizacion ampliada: catalogos empresa/profesional, limites, entitlements, upgrades/downgrades,
   comisiones por contratacion, conciliacion, facturacion, historial financiero y revenue tracking.
5. Adaptadores reales Google Play y Apple, productos de tienda, compras y notificaciones verificadas en backend.
6. Sales/Marketing/Support/Analytics avanzados: las bases actuales no equivalen a esos agentes terminados.
7. IA externa: DeepSeek principal y Gemini secundario respondieron HTTP 402 en la prueba minima
   del 26-09-2026. La conectividad llego a ambos proveedores, pero no hay cuota/facturacion utilizable.
8. Seguridad mobile: audit `--omit=dev` del 26-09-2026 da 54 vulnerabilidades
   (4 critical, 13 high, 35 moderate, 2 low). Requiere plan separado de actualizacion Expo/RN.
   Backend y web: 0 alertas en audit de esta entrega.
9. Cloudflare web + backend, URLs definitivas, CI/CD real, secretos rotados, reglas desplegadas,
   backups, monitoreo operativo y pruebas de pagos/proveedores/tiendas.
10. QA Android/iOS en dispositivos fisicos. Exportar Android o probar componentes no sustituye hardware.

No se declara OfiAI listo para produccion por esta entrega.
