# OfiAI - Guía de Despliegue

La web permanece en Cloudflare Pages (`https://ofiai.pages.dev`). El alojamiento
de la API es Render Free. La validacion del entorno final sigue siendo necesaria.

## Estado del despliegue (2026-10-05)

- Wrangler autorizado para la cuenta del proyecto. No se publico un Worker de API.
- Las pruebas locales de Express/Firebase Admin directamente en Workers fallaron
  por dependencias Node (`iconv-lite`, generacion dinamica de protobuf y `__dirname`).
  Se retiraron los adaptadores experimentales; el backend Node conserva su arquitectura.
- Cloudflare Containers fue descartado por la usuaria por su costo. No contratarlo.
- Cloud Run no fue elegido; requiere cuenta de facturacion.
- Render gratuito sirve para pruebas, no para declarar este backend listo para produccion:
  suspende instancias inactivas y el proveedor desaconseja ese plan para produccion.
- Render CLI y acceso al repositorio privado autorizados. Servicio `ofiai-api`
  creado en el plan `free`: `https://ofiai-api.onrender.com`.
- Backend desplegado y verificado por HTTPS: liveness 200, readiness 200 degradado
  solo por WhatsApp, `/auth/me` sin token 401 y webhook sin firma 401.
- Se cargaron 36 variables protegidas en Render, sin publicar secretos en GitHub.
- `ofiai.pages.dev/login` responde 200 y su bundle apunta a la API de Render, no
  a localhost. Firebase Authentication ya autoriza `ofiai.pages.dev`.
- Lectura minima de Firestore verificada con la cuenta de servicio y la base `default`.
- Falta validar login interactivo y entrega real del webhook desde Mercado Pago.
- No se realizaron cobros de prueba.
- Verificacion local del ajuste de Render: build TypeScript y 311 tests en 28 suites
  correctos. No equivale a validar operaciones reales de pago ni dispositivos moviles.

Referencias: [Cloud Run](https://cloud.google.com/run/pricing),
[requisitos de la cuota gratuita](https://docs.cloud.google.com/free/docs/free-cloud-features),
[limitaciones de Render](https://render.com/docs/free).

## Backend en Render (alojamiento elegido)

- Servicio: `srv-db1i1ugu01pc73ei043g`, region `oregon`, plan `free`.
- Repositorio: `roomii13/OfiAI`, privado, rama `main`.
- Root Directory: vacio; `shared/` debe quedar disponible para TypeScript.
- Runtime: Node 22, `NODE_VERSION=22`.
- Build: `npm --prefix backend ci --include=dev && npm --prefix backend run build`.
- Start: `npm --prefix backend start`.
- Health Check: `/api/v1/health/liveness`.
- Autodeploy desactivado durante la puesta en marcha; desplegar commits verificados.

Variables protegidas: cargar las claves reales desde `backend/.env` solo en Render,
sin subir ese archivo al repositorio. Configuracion especifica:

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://ofiai.pages.dev
TRUST_PROXY_HOPS=3
FIREBASE_DATABASE_ID=default
MERCADOPAGO_NOTIFICATION_URL=https://ofiai-api.onrender.com/api/v1/subscriptions/webhooks/mercadopago
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
```

WhatsApp queda no disponible hasta completar ambas credenciales reales. No usar
valores de ejemplo para forzar un readiness saludable. El resto de los proveedores
conserva sus validaciones obligatorias. En este servicio se verificaron tres saltos:
con uno se observaba una IP interna; con dos, la de Cloudflare; con tres, la IP real.
Solicitudes normales y con `X-Forwarded-For` falsificado conservaron la misma IP
de cliente. Revalidar al cambiar dominio, proveedor o topologia de proxies.

Cloudflare Pages tiene `VITE_API_URL=https://ofiai-api.onrender.com/api/v1`
y `VITE_ENABLE_DEMO_ACCESS=false`. El nuevo bundle publico fue verificado por HTTP.

El webhook publico tambien debe configurarse en la aplicacion de Mercado Pago.
Publicar la URL no valida la firma, la entrega ni un ciclo de cobro real.

Render Free se suspende tras 15 minutos sin trafico y comparte 750 horas mensuales
con los otros servicios gratuitos del workspace. Los cron del proceso no ejecutan
tareas mientras duerme. Esto no modifica la renovacion mensual del proveedor,
pero no garantiza recordatorios, conciliacion o reintentos a horario. No activar
un plan pago ni agregar trafico artificial para evitar la suspension.

## Backend en Google Cloud Run

### Prerrequisitos
- Google Cloud CLI instalado
- Proyecto GCP creado
- Docker instalado
- Firebase CLI instalado para reglas e índices

### Comandos de Despliegue
```bash
# Autenticar con Google Cloud
gcloud auth login
gcloud config set project TU_PROJECT_ID

# Construir desde la raiz: backend y contratos shared, sin secretos
docker build -f backend/Dockerfile -t gcr.io/TU_PROJECT_ID/ofiai-backend .

# Subir imagen al Container Registry
docker push gcr.io/TU_PROJECT_ID/ofiai-backend

# Desplegar en Cloud Run
gcloud run deploy ofiai-backend \
  --image gcr.io/TU_PROJECT_ID/ofiai-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --memory 512Mi \
  --cpu 1
```

### Variables de Entorno en Cloud Run
Usar `backend/.env.example` como plantilla y cargar secretos reales en Secret Manager. El backend mantiene Firestore/Firebase Admin como base principal.

```bash
# Configurar secretos via Google Cloud Secret Manager
gcloud secrets create GEMINI_API_KEY --data-file=- <<< "tu-api-key"
gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=- <<< "tu-private-key"
```

Health checks:

- `GET /api/v1/health/liveness`
- `GET /api/v1/health/readiness`
- `GET /api/v1/health`

El readiness devuelve `503` si faltan credenciales críticas.

## Web en Firebase Hosting

```bash
cd web
npm run build
cd ../shared
firebase deploy --only hosting
```

Configurar `VITE_ENABLE_DEMO_ACCESS=false` para producción.

## Firebase Firestore y Storage

Proyecto base: `ofiai-2f357`.

```bash
cd shared
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Validar reglas con Firebase Emulator Suite antes de producción.

## Mobile con EAS Build

```bash
cd mobile
# Android
npx eas build --platform android
# iOS
npx eas build --platform ios
```

## CI/CD

Pipeline recomendado:

- Backend: `npm run build` y `npm test`.
- Web: `npm run build`.
- Mobile: `npm run typecheck`.
- Despliegue manual aprobado para staging y producción.

## Checklist Pre-Deployment

- Variables por ambiente cargadas en Secret Manager o proveedor equivalente.
- Webhook de Mercado Pago configurado.
- Dominio de Resend verificado.
- WhatsApp Business aprobado.
- Firestore rules revisadas.
- Firestore indexes desplegados.
- Storage rules desplegadas.
- Acceso demo deshabilitado en web y mobile.
