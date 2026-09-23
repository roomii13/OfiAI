# OfiAI - Guía de Despliegue

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

# Construir imagen Docker
cd backend
docker build -t gcr.io/TU_PROJECT_ID/ofiai-backend .

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
