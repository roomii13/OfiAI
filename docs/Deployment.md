# OfiAI - Guía de Despliegue

## Backend en Google Cloud Run

### Prerrequisitos
- Google Cloud CLI instalado
- Proyecto GCP creado
- Docker instalado

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
```bash
# Configurar secretos via Google Cloud Secret Manager
gcloud secrets create GEMINI_API_KEY --data-file=- <<< "tu-api-key"
gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=- <<< "tu-private-key"
```

## Web en Firebase Hosting

```bash
cd web
npm run build
cd ../shared
firebase deploy --only hosting
```

## Mobile con EAS Build

```bash
cd mobile
# Android
npx eas build --platform android
# iOS
npx eas build --platform ios
```

## TODO: Agregar pipeline de CI/CD con GitHub Actions
## TODO: Agregar configuración de variables de entorno por ambiente
## TODO: Agregar checklist de pre-deployment
