# Deployment

Esta guía cubre despliegue de backend, web y mobile con Mercado Pago, Firebase, Resend, WhatsApp y Groq.

## Proveedor IA Actual

Configurar GROQ_API_KEY exclusivamente como secreto del backend. Groq es el proveedor
principal y AI_LEGACY_FALLBACK_ENABLED=false desactiva DeepSeek/Gemini aunque sus claves
sigan presentes. Para evitar cobros usar una organizacion Free y comprobar su plan en
Groq; el codigo no cambia la facturacion de la cuenta. Guia: [Groq](docs/Groq.md).
El modelo inicial es Preview; revisar disponibilidad y calidad antes de produccion.

## Nota de Fase 5

El destino acordado por el usuario es Cloudflare para web y backend. Las instrucciones Cloud Run que siguen son referencia previa, no un despliegue realizado ni la configuracion final elegida.
Esta fase implementa Matching, no cambia infraestructura. Faltan validar el despliegue Cloudflare y las reglas remotas antes de produccion.
Nuevas variables solo backend: GEMINI_MATCHING_MODEL=gemini-3.6-flash, GEMINI_MATCHING_ENABLED=true, MATCHING_CACHE_TTL_SECONDS=1800.
No agregar GROQ_API_KEY, DEEPSEEK_API_KEY ni GEMINI_API_KEY a web/mobile. En la verificacion
historica del 26-09-2026 los proveedores anteriores devolvieron HTTP 402; no estan activos por defecto.
Pruebas y pendientes exactos: [Matching Agent](docs/MatchingAgent.md).

## Validación Previa

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
```

## Backend

Referencia anterior: Google Cloud Run. El destino elegido es Cloudflare y todavia requiere adaptacion y despliegue del backend.

El backend mantiene Firestore/Firebase Admin como base principal.

Variables obligatorias en producción:

- `NODE_ENV=production`
- `PORT=8080`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GROQ_API_KEY` (proveedor actual)
- `GROQ_MODEL=qwen/qwen3.8-27b`
- `AI_LEGACY_FALLBACK_ENABLED=false`
- `AI_BUSINESS_LLM_ENABLED=true` (habilita IA externa en los agentes comerciales)
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_NOTIFICATION_URL`
- `MERCADOPAGO_CURRENCY=ARS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `SCHEDULER_ENABLED=true`

Usar [backend/.env.example](./backend/.env.example) como plantilla. En producción no guardar secretos en el repositorio; cargarlos desde Secret Manager o el panel del proveedor.
Cuenta de servicio base: `firebase-adminsdk-fbsvc@ofiai-2f357.iam.gserviceaccount.com`.

Comandos base:

```bash
cd backend
docker build -t gcr.io/PROJECT_ID/ofiai-backend .
docker push gcr.io/PROJECT_ID/ofiai-backend
gcloud run deploy ofiai-backend \
  --image gcr.io/PROJECT_ID/ofiai-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production
```

Health checks recomendados:

- Liveness: `GET /api/v1/health/liveness`.
- Readiness: `GET /api/v1/health/readiness`.
- General: `GET /api/v1/health`.

El readiness responde `503` si faltan credenciales críticas.

## Web

Destino recomendado: Firebase Hosting, Cloudflare Pages o Vercel.

```bash
cd web
npm run build
```

Publicar `web/dist` con estas variables:

- `VITE_API_URL=https://api.ofiai.com/api/v1`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_MERCADOPAGO_PUBLIC_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_ENABLE_DEMO_ACCESS=false`

## Mobile

Destino recomendado: EAS Build.

```bash
cd mobile
npm run typecheck
npx eas build --platform android
npx eas build --platform ios
```

Variables:

- `EXPO_PUBLIC_API_URL=https://api.ofiai.com/api/v1`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `EXPO_PUBLIC_ENABLE_DEMO_ACCESS=false`

## Firebase

Proyecto base: `ofiai-2f357`.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Antes de publicar, validar reglas con usuarios reales o Firebase Emulator Suite.

## Webhooks

Configurar en Mercado Pago:

- URL: `https://api.ofiai.com/api/v1/subscriptions/webhooks/mercadopago`
- Validación: `MERCADOPAGO_WEBHOOK_SECRET`
- Eventos: `preapproval`, `payment`

## Checklist

- Build backend aprobado.
- Tests backend aprobados.
- Build web aprobado.
- Typecheck mobile aprobado.
- Firebase Admin con service account válida.
- Firestore rules revisadas.
- Firestore indexes desplegados.
- Storage rules desplegadas.
- Mercado Pago en producción, no sandbox.
- Resend con dominio verificado.
- WhatsApp Business con número aprobado.
- Logs y alertas activos.
