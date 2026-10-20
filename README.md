# OfiAI

OfiAI es una plataforma SaaS para conectar empresas con profesionales de oficios en LATAM usando dashboards operativos, reglas de matching, agentes de IA, notificaciones multicanal y suscripciones con Mercado Pago.

## Estado Actual

Entrega del 27/09/2026: agentes comerciales, soporte, inteligencia, Orchestrator, memoria,
gobierno IA y operaciones integrados con Firestore y pantallas web/Expo.
Ver [informe de agentes y operaciones](docs/BusinessAgents.md) para alcance real,
endpoints, archivos, variables y pendientes. La verificacion posterior esta en
[QA y bloqueos de produccion](docs/QA-2026-09-27.md). No certifica produccion ni todas las integraciones externas.

Pricing Agent conectado al flujo Matching, con referencias reales, estimaciones auditables, comparacion de presupuestos, fallback y pantallas web/Expo.
Ver [informe tecnico de Pricing](docs/PricingAgent.md) para API, Firestore, archivos exactos y limites verificados.
Coordinator incorpora workflow persistente bilateral, ofertas, agenda, finalizacion y auditoria.
Ver [informe tecnico de Coordinator](docs/CoordinatorAgent.md) para alcance, pruebas y pendientes de produccion.
Reputation completo sigue pendiente. La ampliacion comercial esta detallada en
[Monetizacion](docs/Monetization.md), incluidos limites de tiendas nativas y facturacion.
Esta entrega no modifica precios ni renovaciones mensuales de Mercado Pago.

Fase 5: Matching Agent conectado a Jobs reales, Firestore, web y Expo. Incluye filtros deterministas,
enriquecimiento estructurado opcional, fallback, cache y seleccion previa a contratar.
Ver [informe tecnico de Matching](docs/MatchingAgent.md) para endpoints, archivos exactos y pruebas.
Groq es ahora el proveedor principal; DeepSeek/Gemini quedan deshabilitados por defecto.
GROQ_API_KEY ya esta configurada localmente y se verifico Intake con llamadas reales.
Ver [configuracion, cuotas y limites de Groq](docs/Groq.md). Los fallos HTTP 402 de los
proveedores anteriores corresponden a la verificacion historica del 26-09-2026.

Backend, web y mobile ya tienen una base funcional compilable:

- Backend Express + TypeScript con Auth, Companies, Professionals, Jobs, Dashboard, IA, Suscripciones, Notificaciones, Analytics, Scheduler e integraciones.
- Web React + Vite con login, registro, dashboards, empresas, profesionales, trabajos, IA, suscripciones, analytics, configuración y admin.
- Mobile Expo con navegación, login, registro, dashboard, trabajos, perfil, IA, notificaciones y configuración.
- Tests iniciales unitarios, integración y API en backend.
- demo-user:
- | Rol         | Email                         | Contraseña |
  
| Profesional   | profesional@demo.ofiai.local  | `OfiAI-Pro-2026!` |
| Empresa       | empresa@demo.ofiai.local      | `OfiAI-Empresa-2026!` |
| Administrador | admin@demo.ofiai.local        | `OfiAI-Admin-2026!` |

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express, TypeScript, Firebase Admin, Firestore |
| IA | Reglas propias y Groq en backend; proveedores anteriores solo por opt-in |
| Pagos | Mercado Pago |
| Notificaciones | Resend, WhatsApp, push e internas |
| Web | React, Vite, TailwindCSS |
| Mobile | Expo 54, React Native 0.81.5, React Navigation 7 |
| Tests | Jest, ts-jest |

## Comandos

```bash
cd backend
npm run build
npm test
```

```bash
cd web
npm run build
```

```bash
cd mobile
npm run typecheck
npx expo start
```

## Demo Alexa+

La ruta `/alexa-demo` ofrece una simulación conversacional en español de OfiAI para el track Alexa+.
Está construida como experiencia ilustrativa: usa perfiles ficticios y reglas locales, no llama al backend,
no publica solicitudes ni contacta profesionales. La conversación muestra Intake, Matching, revisión de precio
y coordinación supervisada; los flujos reales siguen disponibles tras iniciar sesión en OfiAI.

Para ejecutarla localmente:

```bash
cd web
npm run dev
```

Abrir `http://localhost:5173/alexa-demo`. La simulación no representa un dispositivo, voz ni integración Alexa+ real.

## Variables Principales

Backend:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `AI_LEGACY_FALLBACK_ENABLED=false`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_NOTIFICATION_URL`
- `RESEND_API_KEY`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `JWT_SECRET`

Frontend:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_MERCADOPAGO_PUBLIC_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_ENABLE_DEMO_ACCESS=false` en producción

Mobile:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `EXPO_PUBLIC_ENABLE_DEMO_ACCESS=false` en producción

El proyecto Firebase configurado como base es `ofiai-2f357`. Las claves sensibles no deben commitearse: copiar los `.env.example` a `.env`/`.env.local` y cargar secretos reales en Secret Manager o el proveedor del hosting.

## Documentación

- [API.md](./API.md)
- [Database.md](./Database.md)
- [Deployment.md](./Deployment.md)
- [Roadmap.md](./Roadmap.md)
- [BusinessModel.md](./BusinessModel.md)
- [Monetizacion: precios, implementacion y pendientes](./docs/Monetization.md)
- [PromptEngineering.md](./PromptEngineering.md)
- [AIAgents.md](./AIAgents.md)
- [Groq: activacion y limites](./docs/Groq.md)
- [Agentes comerciales, operaciones y pendientes](./docs/BusinessAgents.md)

## Validación Local

Validacion de agentes y operaciones del 27/09/2026:

- Backend: compilacion TypeScript correcta.
- Web: build correcto, con advertencias de bundle/configuracion Vite.
- Mobile: typecheck correcto.
- Testing, emuladores y dispositivos aplazados expresamente; no hubo llamadas a proveedores ni despliegue.

Validaciones de entregas anteriores (no cubren los nuevos cambios):

- `backend`: `npm run build`, `npm test`
- `web`: `npm run build`
- `mobile`: `npm run typecheck`
