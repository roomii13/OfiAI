# OfiAI

OfiAI es una plataforma SaaS para conectar empresas con profesionales de oficios en LATAM usando dashboards operativos, reglas de matching, agentes de IA, notificaciones multicanal y suscripciones con Mercado Pago.

## Estado Actual

Pricing Agent conectado al flujo Matching, con referencias reales, estimaciones auditables, comparacion de presupuestos, fallback y pantallas web/Expo.
Ver [informe tecnico de Pricing](docs/PricingAgent.md) para API, Firestore, archivos exactos, 191 tests y limites verificados.
Coordinator y monetizacion ampliada tienen contratos preparados, no implementaciones completas. Las renovaciones actuales de Mercado Pago no se modificaron.

Fase 5: Matching Agent conectado a Jobs reales, Firestore, web y Expo. Incluye filtros deterministas, Gemini estructurado opcional, fallback, cache y seleccion previa a contratar.
Ver [informe tecnico de Matching](docs/MatchingAgent.md) para endpoints, archivos exactos y pruebas. El proveedor Gemini devuelve 402 en la comprobacion actual; no se declara produccion validada.

Backend, web y mobile ya tienen una base funcional compilable:

- Backend Express + TypeScript con Auth, Companies, Professionals, Jobs, Dashboard, IA, Suscripciones, Notificaciones, Analytics, Scheduler e integraciones.
- Web React + Vite con login, registro, dashboards, empresas, profesionales, trabajos, IA, suscripciones, analytics, configuración y admin.
- Mobile Expo con navegación, login, registro, dashboard, trabajos, perfil, IA, notificaciones y configuración.
- Tests iniciales unitarios, integración y API en backend.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express, TypeScript, Firebase Admin, Firestore |
| IA | Reglas propias, agentes internos, Gemini preparado |
| Pagos | Mercado Pago |
| Notificaciones | Resend, WhatsApp, push e internas |
| Web | React, Vite, TailwindCSS |
| Mobile | Expo, React Native, React Navigation |
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

## Variables Principales

Backend:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`
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
- [PromptEngineering.md](./PromptEngineering.md)
- [AIAgents.md](./AIAgents.md)

## Validación Local

Últimas validaciones realizadas:

- `backend`: `npm run build`, `npm test`
- `web`: `npm run build`
- `mobile`: `npm run typecheck`
