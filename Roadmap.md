# Roadmap

## Entrega 27/09/2026

Detalle y limites: [Agentes comerciales y operaciones](docs/BusinessAgents.md).

- Integrados Sales, Marketing, Support y Analytics sobre los agentes existentes.
- Integrados Orchestrator con outbox de Jobs, memoria explicita, gobierno IA, moderacion y Command Center.
- Nuevas vistas web y Expo, compilacion correcta. Testing aplazado por pedido del usuario.
- Pendientes avanzados: envio externo de marketing, embeddings/vector search, eventos de negocio completos,
  instrumentacion y datos BI faltantes, QA integral, reglas/indices desplegados y produccion.
- Los conteos de vulnerabilidades y resultados de tests mencionados abajo pertenecen a revisiones anteriores;
  no se volvio a ejecutar audit ni tests en esta entrega.

Estado actualizado de la fase Coordinator: [integracion, pruebas y pendientes](docs/CoordinatorAgent.md).
Los informes de Matching y Pricing conservan la evidencia de sus entregas anteriores.

## Completado

- Arquitectura backend modular con Config, Middleware, Auth, Companies, Professionals, Jobs, Dashboard, IA, Suscripciones, Notificaciones, Analytics y Scheduler.
- Migración de pagos a Mercado Pago.
- Matching, ranking, clasificación, pricing y chat IA con reglas propias y preparación para Gemini.
- Frontend web funcional con rutas principales.
- App móvil Expo funcional con navegación y pantallas principales.
- Tests iniciales unitarios, integración y API.
- Documentación raíz de API, datos, despliegue, negocio, prompts y agentes.
- Matching y Pricing con Job real, persistencia, cache, fallback, contratos y pantallas web/Expo.
- Coordinator bilateral persistente: propuestas, contraofertas, agenda, inicio, cierre e historial.

## Necesario Para Producción

- Completar QA de todos los flujos autenticados con dispositivos y proveedores reales.
- Desplegar las reglas revisadas y verificar permisos del entorno destino; Admin SDK no valida Rules.
- Mantener pruebas transaccionales y de Rules con Firebase Emulator Suite en CI.
- Ejecutar smoke tests de Mercado Pago en sandbox y producción.
- Verificar dominio Resend y plantillas finales.
- Validar WhatsApp Business Cloud API con plantillas aprobadas.
- Agregar observabilidad: logs estructurados, métricas, alertas y trazas.
- Configurar CI/CD con build, tests, lint y despliegue por ambiente.
- Definir backups, retención de datos y runbooks de incidentes.
- Completar QA responsive web y QA en dispositivos físicos Android/iOS.
- Resolver vulnerabilidades mobile: audit de esta entrega registra 59 alertas, 4 critical y 18 high. No se actualizo Expo.
- Verificar Gemini disponible en vivo; las pruebas con dobles no prueban cuota/facturacion.

## Próximas Iteraciones

1. Reviews verificadas y Reputation completo alimentando Matching.
2. Ampliar Coordinator: SLA, agenda sin conflictos, no-show, disputas y cambios de acuerdos iniciados.
3. Completar feature gating avanzado sobre el catalogo, cuotas y entitlements ya integrados en Monetizacion.
4. Completar comisiones, facturacion, conciliacion e historial financiero sin alterar renovaciones mensuales.
5. Integrar compras digitales verificadas de Google Play y Apple; Mercado Pago conserva su integracion existente.
6. Calibrar Matching/Pricing con evidencia real y completar las integraciones avanzadas de soporte/ventas/marketing/analytics documentadas en BusinessAgents.
7. Preparar staging y produccion web/backend en Cloudflare, CI/CD, observabilidad y recuperacion.
