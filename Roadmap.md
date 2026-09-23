# Roadmap

## Completado

- Arquitectura backend modular con Config, Middleware, Auth, Companies, Professionals, Jobs, Dashboard, IA, Suscripciones, Notificaciones, Analytics y Scheduler.
- Migración de pagos a Mercado Pago.
- Matching, ranking, clasificación, pricing y chat IA con reglas propias y preparación para Gemini.
- Frontend web funcional con rutas principales.
- App móvil Expo funcional con navegación y pantallas principales.
- Tests iniciales unitarios, integración y API.
- Documentación raíz de API, datos, despliegue, negocio, prompts y agentes.

## Necesario Para Producción

- Conectar web y mobile a Firebase Auth real intercambiando `customToken` por ID token en todos los flujos.
- Validar Firestore rules con usuarios reales por rol.
- Ejecutar pruebas de integración con Firebase Emulator Suite.
- Ejecutar smoke tests de Mercado Pago en sandbox y producción.
- Verificar dominio Resend y plantillas finales.
- Validar WhatsApp Business Cloud API con plantillas aprobadas.
- Agregar observabilidad: logs estructurados, métricas, alertas y trazas.
- Configurar CI/CD con build, tests, lint y despliegue por ambiente.
- Definir backups, retención de datos y runbooks de incidentes.
- Completar QA responsive web y QA en dispositivos físicos Android/iOS.

## Próximas Iteraciones

1. Persistir dashboards web/mobile con datos reales de Firestore.
2. Agregar Firebase Emulator Suite a tests de repositorios.
3. Implementar propuestas, contratación y reseñas.
4. Agregar checkout mobile usando deep links de Mercado Pago.
5. Completar panel admin con controles operativos y auditoría.
6. Medir precisión de matching y registrar feedback humano.
7. Preparar despliegue staging y producción.
