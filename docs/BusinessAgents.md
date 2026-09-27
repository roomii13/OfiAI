# Agentes comerciales y operaciones de OfiAI
Fecha: 27/09/2026. Desarrollo incremental sobre la arquitectura existente. Testing aplazado por pedido del usuario.

## Estado de la entrega
Se integraron servicios persistentes, endpoints autenticados y pantallas web/Expo. Esto NO certifica produccion ni significa que todas las capacidades avanzadas del roadmap esten terminadas.

| Fase | Integrado | Limite actual |
| --- | --- | --- |
| Sales | CRM, calificacion, intencion, prioridades, mensajes, seguimiento, recuperacion, recomendacion de plan, interacciones y conversiones | Leads de cuentas registradas con consentimiento; sin prospeccion externa |
| Marketing | Segmentos, campanas, dos variantes, borradores por canal, aprobacion, despacho interno, evidencia y metricas | Email/redes/landing/SEO son borradores; no publicacion externa |
| Support | Conversaciones persistentes, FAQ, herramientas con ownership, conocimiento citado y tickets humanos | No ejecuta pagos ni modificaciones arbitrarias |
| Analytics | Preguntas sobre evidencia real por rol, trabajos, fechas, categorias, actividad y facturacion | Sin costos/cohortes no calcula rentabilidad, LTV o predicciones |
| Orchestrator | Eventos, estados, permisos, herramientas, idempotencia, reintentos y trazabilidad | Job creado es automatico via scheduler; resto de eventos parcialmente manual |
| Memory/Knowledge | Memoria privada, organizacional y por Job, documentos publicados, citas, consentimiento y vencimiento | Recuperacion lexical; embeddings y busqueda vectorial pendientes |
| Seguridad | RBAC, ownership, validacion, redaccion de secretos, herramientas permitidas, cuotas y Rules cerradas | No equivale a auditoria integral ni inmunidad a prompt injection |
| Governance | Latencia, tokens observados, costos estimados, errores, fallback y revision humana | Cobertura acotada a rutas instrumentadas; sin alertas externas |
| Mobile | Nuevas pantallas nativas equivalentes a operaciones web | No se audito toda la app ni se ejecuto Android/iOS |
| Admin | Proyecciones paginadas, moderacion, tickets, revision IA y auditoria | Sin arbitraje financiero ni reembolsos |
| BI | Command Center de mercado/producto/economia/IA con procedencia | Metricas sin evidencia permanecen null |

Se mantuvieron los precios pagos desde USD35, las renovaciones mensuales de Mercado Pago y el resto de funcionalidades existentes. No se modificaron secretos de .env, no se enviaron campanas, no se cobraron pagos, no se crearon seeds ni se escribieron datos de negocio en Firestore real durante esta entrega.

## Sales y consentimiento
- El usuario declara necesidad, volumen mensual y autorizacion de contacto. UID, rol y empresa se resuelven en servidor.
- Pipeline: LEAD, QUALIFIED, CONTACTED, INTERESTED, TRIAL, CUSTOMER y LOST. TRIAL es evaluacion comercial, no acceso gratuito a funciones pagas.
- Recomendacion del plan mas economico que cubre el volumen declarado, usando el catalogo existente.
- La conversion CUSTOMER requiere contrato pago vigente y pago confirmado no reintegrado totalmente. Se reconcilia por accion administrativa o al procesar un seguimiento pendiente; no hay backfill continuo de todos los leads.
- Deteccion de abandono por inactividad observada de siete dias. No se infiere intencion externa como un hecho.
- Primer seguimiento dos dias despues del consentimiento; maximo tres, separados por tres dias. Solo notificacion interna.
- Se revalidan consentimiento, estado de cuenta y version dentro de la transaccion que crea la interaccion.
- La tasa del listado CRM corresponde a la pagina actual; el Command Center usa conteos de todo el CRM.

## Marketing y atribucion
Solo in_app tiene despacho real. email, social, landing y seo conservan variantes editables para revision humana.
La aprobacion es explicita; editar una campana sin entregas devuelve su estado a draft. Campanas ya entregadas no permiten sustituir el contenido.
Despacho por lotes de hasta 20 leads, asignacion estable A/B, recibo por destinatario y control de frecuencia comercial de siete dias por usuario.
No se consideran impresiones o clics las entregas de notificaciones. Los informes de rendimiento son evidencia declarada por administracion, no cobros verificados.
CTR, conversion, CAC, retencion, churn y ROAS se calculan solo cuando los denominadores y datos necesarios existen. ROI y LTV permanecen desconocidos sin margen/costos/cohortes.
Los insights incorporan Analytics con limites explicitos; correlacion no se presenta como causalidad.

## Support y herramientas
Herramientas controladas: getJob, getSubscription, getInvoice, getProfessional, searchKnowledge y escalamiento a ticket.
getJob permite empresa propietaria, profesional asignado o administrador y devuelve una proyeccion.
getSubscription/getInvoice consultan solo al titular, incluso con rol admin. getInvoice devuelve un recibo del ledger, no una factura fiscal.
getProfessional proyecta exclusivamente campos publicos de un perfil activo.
El modelo no recibe acceso libre al SDK de Firestore, nombres de colecciones ni capacidad de ejecutar herramientas arbitrarias.
Sesiones propias, hasta 100 mensajes, idempotencia por requestId y control de version. La conversacion conserva contexto; la seleccion IA de documentos valida IDs existentes y devuelve citas reales.
Incidentes, fraude, problemas de facturacion o solicitud de una persona generan escalamiento. Operadores pueden asignarse tickets, responder y resolver; no modificar cobros.

## Analytics y Command Center
- Empresa: trabajos propios. Profesional: trabajos asignados. Administracion: plataforma.
- Lecturas acotadas a 500 trabajos, 500 profesionales/contratos y hasta 5000 eventos observados; respuesta indica muestreo/limites.
- El parametro month aplica al periodo financiero. Distribuciones de trabajos/categorias/ciudades describen la muestra disponible, no automaticamente ese mes ni una tendencia.
- Revenue usa el ledger confirmado y separa monedas. MRR es contractual activo; ARR es su proyeccion anual, no ingresos cobrados.
- Gasto personal: pagos propios de suscripcion del mes, hasta 50 recibos recientes. No suma pagos de trabajos que aun no se registran.
- DAU/MAU reflejan actividad instrumentada y en parte declarada por clientes. No son una auditoria completa del uso del producto.
- Trabajos demorados se identifican por estado y fecha. No hay modelo calibrado de probabilidad de retraso.
- GMV, beneficio por categoria, LTV, CAC global, cohortes, churn global, ROI global y tasa de automatizacion no se inventan.
- Conversion comercial global: clientes CRM con pago confirmado / leads CRM, no visitas convertidas.

## Orchestrator y eventos
Eventos admitidos: job.created, job.review, business.review y sales.review. Cada ejecucion conserva actor, recurso, estado, pasos, herramienta, duracion, decision y referencias minimas.
La publicacion normal de Job y desde Intake crea agent_events en la misma transaccion del Job. Publicar un borrador tambien registra el evento; no se reconstruyen Jobs antiguos.
Worker acotado a cinco eventos, lease de cuatro minutos y maximo tres intentos con backoff. El scheduler existente lo invoca cada diez minutos.
Run idempotente por usuario/requestId, lease de tres minutos y limite de intentos. Un mismo requestId no puede cambiar evento/recurso.
El pipeline llama los servicios existentes de Matching y Pricing, aprovechando su cache; conserva el matching inmediato preexistente.
Si hay Coordinacion, consulta su estado y siguiente accion; no contrata ni paga automaticamente.
Un trabajo completado prepara el pase a Reputation sin inventar reviews. Reputation avanzado y su integracion completa con ranking siguen pendientes.
Solo herramientas predefinidas por rol y presupuesto de llamadas. Un timeout de 90 segundos se comprueba entre herramientas y los proveedores tienen sus propios timeouts; no es cancelacion universal de consultas Firestore en curso.
Los eventos de negocio mas amplios, disparadores de Marketing/Support y workflows distribuidos completos quedan por conectar.

## Memoria y conocimiento
Scopes: user (privado), company (empresa autenticada), job (privado por participante autorizado) y platform (publicacion administrativa).
No se extrae memoria personal implicitamente. Crear contenido requiere consentimiento; maximo 8000 caracteres y retencion de 1 a 365 dias.
Solo documentos publicados y no vencidos se recuperan; citas incluyen documento, version y fragmento.
Busqueda lexical con hasta 100 documentos por scope y cinco resultados. El contrato EmbeddingProvider queda preparado, sin embeddings ficticios.
No hay descargas de URLs arbitrarias ni ingesta externa automatica.
Vencimiento logico inmediato y limpieza diaria de hasta 100 documentos desde scheduler. La auditoria de borrado conserva metadatos/hash, no el texto eliminado.
No se habilito una politica TTL de Firestore para telemetria: su retencion historica requiere una politica operativa separada.

## Seguridad y gobierno
Todas las rutas nuevas requieren autenticacion y limitador HTTP existente. Administracion se valida tanto en rutas como en servicios.
Roles y ownership provienen del servidor. Suspension tambien desactiva perfil/disponibilidad profesional, evitando recomendaciones posteriores.
Rules requieren cuenta activa y rol persistido. Alta directa de usuarios por SDK cliente queda cerrada; el alta existente utiliza backend/Admin SDK.
Las colecciones nuevas niegan acceso directo desde SDK cliente, incluso a administradores: las acciones se realizan mediante la API.
Admin SDK no aplica Firestore Rules; por eso los repositorios y herramientas verifican permisos separadamente.
JSON validado, entradas limitadas, evidencia de intencion cotejada y seleccion de documentos/fact IDs existentes. El texto de usuarios/documentos es contenido no confiable, nunca autorizacion.
Se redactan formatos conocidos de secretos y credenciales; eso no garantiza detectar toda informacion sensible posible.
Observaciones conservan metadatos, no prompts completos, preguntas o respuestas. Revision humana distingue sospecha, problema confirmado y salida aceptable.
No se afirma medir automaticamente la tasa real de alucinaciones.
Costos estimados solo con tokens observados y tarifas configuradas. No equivalen a facturas de proveedor; descuentos/cache pueden requerir desglose adicional.
El limite diario cuenta invocaciones comerciales; fallback entre proveedores puede usar mas de una solicitud. No es un presupuesto monetario estricto.
La cobertura incluye IA comercial y llamadas dentro del Orchestrator; faltan otras rutas legacy y exportadores/alertas productivas.

## Endpoints nuevos
Prefijo /api/v1. Las escrituras validan schemas estrictos y, cuando corresponda, version/requestId.

| Metodo | Ruta | Acceso |
| --- | --- | --- |
| GET, PUT | /sales/me | Cuenta propia |
| POST | /sales/me/reply | Cuenta propia |
| GET | /sales/leads | Admin |
| GET | /sales/leads/:id | Admin |
| POST | /sales/leads/:id/commands | Admin |
| GET, POST | /marketing | Admin |
| GET | /marketing/:id | Admin |
| POST | /marketing/:id/commands | Admin |
| POST | /marketing/:id/content | Admin |
| POST | /marketing/:id/reports | Admin |
| GET | /marketing/:id/insights | Admin |
| GET, POST | /support/sessions | Cuenta propia |
| GET | /support/sessions/:id | Titular |
| POST | /support/sessions/:id/messages | Titular |
| GET | /support/tickets | Admin |
| GET | /support/tickets/:id | Admin |
| POST | /support/tickets/:id/commands | Admin |
| GET | /intelligence?month=YYYY-MM | Por rol/ownership |
| POST | /intelligence/questions | Por rol/ownership |
| GET, POST | /agents/runs | Autenticado, permisos por evento |
| GET | /agents/runs/:id | Titular o admin |
| GET, POST | /knowledge | Scope autorizado |
| POST | /knowledge/search | Scope autorizado |
| POST | /knowledge/:id/commands | Scope autorizado |
| GET | /governance | Admin |
| POST | /governance/:id/reviews | Admin |
| GET | /admin/operations | Admin |
| POST | /admin/operations/commands | Admin |
| GET | /admin/command-center?month=YYYY-MM | Admin |

Los endpoints admin existentes conservan sus URLs; suspension utiliza ahora el mismo servicio auditado y las lecturas devuelven proyecciones acotadas.

## Firestore
Nuevas colecciones/documentos:
- sales_leads/{uid}, interactions y delivery_state/marketing.
- marketing_campaigns/{id}, reports y deliveries.
- support_sessions/{id}, requests.
- support_tickets/{id}, audit.
- agent_runs/{id}.
- agent_events/{id}.
- ai_knowledge/{id}.
- agent_audit/{id}.
- ai_observations/{id}, reviews/{adminUid}.
- ai_budgets/{uidHash_day}.

Se reutilizan users, companies, professionals, jobs, subscriptions, billing_payments, billing_revenue, analytics_events y notificaciones existentes.
Indices compuestos agregados: support_sessions(ownerId ASC,updatedAt DESC), agent_runs(ownerId ASC,createdAt DESC), ai_knowledge(scopeKey ASC,updatedAt DESC), agent_events(state ASC,availableAt ASC).
Reglas e indices estan en shared. NO fueron desplegados ni validados con emulador en esta entrega. Las consultas que requieren esos indices pueden fallar hasta desplegarlos.

## IA y variables
Prompts versionados en business.prompts.ts para Sales, Marketing, Support y Analytics, version 1.0.0.
En esta entrega original se extendieron los agentes y el cliente existentes con DeepSeek/Gemini.
La integracion posterior utiliza Groq primero y desactiva ambos respaldos salvo opt-in.
Ver [Groq](Groq.md) para configuracion vigente. No hay keys de IA en frontend.
Nuevas variables exclusivamente backend:

```dotenv
AI_BUSINESS_LLM_ENABLED=false
AI_BUSINESS_DAILY_CALL_LIMIT=20
AI_COST_RATES_JSON={}
```

AI_COST_RATES_JSON acepta groq, deepseek y/o gemini con inputUsdPerMillion y outputUsdPerMillion. Las tarifas deben provenir de la cuenta/proveedor, no se precargan cifras inventadas.
Con AI_BUSINESS_LLM_ENABLED=false, las nuevas funciones comerciales operan con reglas y evidencia, sin llamar proveedores.
El switch no desactiva todos los agentes previos: los endpoints legacy y el Orchestrator reutilizan sus propias configuraciones.
No se modificaron las credenciales existentes. Las claves compartidas previamente por chat deben rotarse antes de produccion.
SCHEDULER_ENABLED ya existia: en la vista previa local permanece false para no procesar cobros/seguimientos/tareas reales inadvertidamente.

## Web y mobile
Web: menu Operaciones, ruta /operations/:section.
Secciones: support, intelligence, knowledge, runs, sales; admin agrega marketing, governance, admin y center.
Mobile: Perfil > Operaciones, con formularios, conversaciones, tabs desplazables, selectores nativos, confirmaciones y estados de carga/error/vacio.
Las mutaciones usan exclusividad inmediata, versiones y requestId cuando corresponde. Publicacion, contacto, borrado y moderacion exigen accion humana.
No se afirman capturas o comprobaciones visuales: la revision funcional, responsive, accesibilidad y dispositivos se aplazo.

## Verificacion de esta entrega
Actualizacion posterior: [QA del 27/09/2026](QA-2026-09-27.md) registra pruebas,
Firestore Emulator y migracion a Expo 54. La lista siguiente conserva el alcance
de la entrega inicial, anterior a esa verificacion.
- Backend: TypeScript tsc correcto.
- Web: npm run build correcto; conserva advertencias de bundle grande y configuracion Vite.
- Mobile: tsc --noEmit correcto.
- git diff --check sin errores de whitespace; advertencias LF/CRLF del repositorio.
- Vista previa local: backend reiniciado con scheduler e IA comercial desactivados; liveness HTTP 200 y servidor web HTTP 200. Esto solo comprueba arranque, no flujos autenticados.
- NO se ejecutaron ni agregaron tests nuevos, emuladores, pruebas adversariales, Playwright o Android Studio.
- NO hubo llamadas reales a DeepSeek/Gemini, envios externos, cobros ni despliegue.
- Los tests y resultados de documentos anteriores corresponden a sus fechas, no validan estos cambios.

## Recorrido de revision posterior
1. Desplegar reglas/indices en staging y configurar backend/web/mobile del mismo ambiente.
2. Ingresar como empresa/profesional, abrir Operaciones y guardar preferencias comerciales con consentimiento explicito.
3. Como admin, revisar CRM y calificacion; cualquier contacto o despacho envia una notificacion real al destinatario indicado.
4. Crear campana, revisar variantes y segmento, aprobar y despachar solo a destinatarios de prueba autorizados.
5. Abrir soporte con un Job propio; intentar un Job ajeno en la futura suite de autorizacion y verificar escalamiento humano.
6. Publicar conocimiento no sensible, consultarlo con citas y comprobar scopes, versiones y vencimiento.
7. Crear Job de prueba, revisar Matching/Pricing y ejecuciones; activar scheduler solo en un entorno deliberadamente preparado.
8. Habilitar IA comercial con saldo/cuota, validar fallback y observar consumo real.
9. Contrastar Command Center con datos fuente por moneda y periodo, sin confundir muestras con totales.
10. Ejecutar posteriormente unit/integration/API/authorization/AI/frontend/E2E y paridad Android/iOS.

## Pendientes concretos
- Proveedores de email/redes/landing/SEO y medicion de impresion/clic/atribucion reales, con aprobaciones y opt-out por canal.
- Captacion externa de leads autorizada, conciliacion completa CRM-pagos y cohortes.
- Embeddings, indice vectorial, evaluacion RAG e ingesta documental controlada.
- Reviews verificadas, Reputation completo alimentando Matching y avances de Coordinator/SLA/disputas.
- Orquestacion de todos los eventos de negocio, cancelacion uniforme, aislamiento de fallos del scheduler y recuperacion operativa.
- Instrumentacion IA global, presupuesto monetario, retencion/TTL, alertas, exportacion de trazas y runbooks.
- Datos/calculos completos de GMV, margen, CAC/LTV/cohortes, churn y automatizacion.
- QA y seguridad real de toda la aplicacion, Rules/emulador y correccion de vulnerabilidades; no se actualizo Expo.
- Suscripciones Play/Apple reales, cobro de comisiones, emision fiscal y validacion de Mercado Pago del roadmap comercial.
- Despliegue Cloudflare, dominios, scheduler productivo, secretos rotados, indices/reglas, backups y CI/CD.

## Archivos creados en esta entrega
- backend/src/ai/prompts/business.prompts.ts
- backend/src/ai/tools/analytics.tool.ts
- backend/src/ai/tools/business-ai.tool.ts
- backend/src/ai/tools/knowledge.tool.ts
- backend/src/ai/tools/support.tool.ts
- backend/src/constants/agent-policy.ts
- backend/src/controllers/agent-http.ts
- backend/src/controllers/intelligence.controller.ts
- backend/src/controllers/knowledge.controller.ts
- backend/src/controllers/marketing.controller.ts
- backend/src/controllers/operations.controller.ts
- backend/src/controllers/orchestrator.controller.ts
- backend/src/controllers/sales.controller.ts
- backend/src/controllers/support.controller.ts
- backend/src/events/agent.event.ts
- backend/src/models/agent.model.ts
- backend/src/models/marketing.model.ts
- backend/src/models/sales.model.ts
- backend/src/monitoring/ai-usage.ts
- backend/src/repositories/agent-data.repository.ts
- backend/src/repositories/agent-event.repository.ts
- backend/src/repositories/governance.repository.ts
- backend/src/repositories/intelligence.repository.ts
- backend/src/repositories/knowledge.repository.ts
- backend/src/repositories/marketing.repository.ts
- backend/src/repositories/operations.repository.ts
- backend/src/repositories/orchestrator.repository.ts
- backend/src/repositories/sales.repository.ts
- backend/src/repositories/support.repository.ts
- backend/src/routes/governance.routes.ts
- backend/src/routes/intelligence.routes.ts
- backend/src/routes/knowledge.routes.ts
- backend/src/routes/marketing.routes.ts
- backend/src/routes/orchestrator.routes.ts
- backend/src/routes/sales.routes.ts
- backend/src/routes/support.routes.ts
- backend/src/services/governance.service.ts
- backend/src/services/intelligence.service.ts
- backend/src/services/knowledge.service.ts
- backend/src/services/marketing.service.ts
- backend/src/services/operations.service.ts
- backend/src/services/orchestrator.service.ts
- backend/src/services/sales.service.ts
- backend/src/services/support.service.ts
- backend/src/utils/agent-text.ts
- backend/src/validators/agent.validator.ts
- backend/src/validators/knowledge.validator.ts
- backend/src/validators/marketing.validator.ts
- backend/src/validators/sales.validator.ts
- backend/src/validators/support.validator.ts
- backend/src/workers/orchestrator.worker.ts
- backend/src/workers/sales.worker.ts
- shared/sales.d.ts
- shared/marketing.d.ts
- shared/support.d.ts
- shared/intelligence.d.ts
- shared/orchestrator.d.ts
- shared/knowledge.d.ts
- shared/operations.d.ts
- web/src/app/AgentWorkspace.tsx
- web/src/app/GrowthPanels.tsx
- web/src/app/SupportKnowledgePanels.tsx
- web/src/app/IntelligencePanels.tsx
- web/src/app/OperationsPanels.tsx
- web/src/app/MarketingEditor.tsx
- web/src/app/agents.css
- mobile/src/navigation/AgentOperationsScreen.tsx
- mobile/src/navigation/AgentOperationsUi.tsx
- mobile/src/navigation/MobileGrowthPanels.tsx
- mobile/src/navigation/MobileSupportPanels.tsx
- mobile/src/navigation/MobileIntelligencePanels.tsx
- mobile/src/navigation/MobileOperationsPanels.tsx
- mobile/src/navigation/MobileMarketingEditor.tsx
- docs/BusinessAgents.md

## Archivos modificados en esta entrega
- README.md
- Roadmap.md
- API.md
- Database.md
- AIAgents.md
- backend/.env.example
- backend/src/ai/agents/sales.agent.ts
- backend/src/ai/agents/marketing.agent.ts
- backend/src/ai/agents/support.agent.ts
- backend/src/ai/agents/analytics.agent.ts
- backend/src/config/env.ts
- backend/src/controllers/admin.controller.ts
- backend/src/database/firestore/collections.ts
- backend/src/integrations/deepseek.client.ts
- backend/src/integrations/gemini/gemini.client.ts
- backend/src/repositories/intake.repository.ts
- backend/src/repositories/jobs.repository.ts
- backend/src/routes/index.ts
- backend/src/routes/admin.routes.ts
- backend/src/scheduler/scheduler.service.ts
- shared/firestore.rules
- shared/firestore.indexes.json
- web/src/app/Router.tsx
- web/src/layouts/DashboardLayout.tsx
- mobile/src/navigation/index.tsx
- mobile/src/types/index.ts

El cliente DeepSeek ya existia en el arbol de trabajo aunque Git aun lo mostraba sin seguimiento. No se reemplazaron ni revirtieron cambios de entregas anteriores.

## Referencias de seguridad consultadas
- [OWASP: seguridad de agentes](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [OWASP: prevencion de prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [Firebase: condiciones en Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firestore: transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions)
