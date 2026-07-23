# OfiAI - Guía de Desarrollo

## Requisitos del Sistema

- Node.js 20+
- npm 10+
- Git 2.40+
- Expo CLI (`npm install -g expo-cli`)
- Cuenta Firebase con proyecto creado
- API Key de Google Gemini

## Configuración del Entorno

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-org/ofiai.git
cd ofiai
```

### 2. Configurar Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales
npm install
npm run dev
```

### 3. Configurar Web
```bash
cd web
# Crear .env.local con variables VITE_FIREBASE_*
npm install
npm run dev
```

### 4. Configurar Mobile
```bash
cd mobile
npm install
npx expo start
```

## Variables de Entorno Requeridas

Ver `backend/.env.example` para la lista completa.

Para el frontend web, crear `web/.env.local`:
```
VITE_API_URL=http://localhost:8080/api/v1
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## TODO: Agregar guía de configuración de Firebase project
## TODO: Agregar guía de configuración de Stripe webhooks locales
