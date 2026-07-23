# OfiAI 🤖🔧

**Plataforma SaaS impulsada por Inteligencia Artificial para conectar empresas con profesionales de oficios en Latinoamérica.**

[![Estado](https://img.shields.io/badge/Estado-En%20Desarrollo-yellow)]
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Firebase%20%7C%20Gemini-blue)]
[![Cloud](https://img.shields.io/badge/Cloud-Google%20Cloud%20Run-orange)]

---

## 🚀 Descripción

OfiAI utiliza agentes de Inteligencia Artificial (Google Gemini API) para:
- **Empresas**: Encontrar, evaluar y contratar profesionales de oficios de forma inteligente
- **Profesionales**: Recibir recomendaciones de trabajos compatibles y generar propuestas asistidas por IA
- **Administradores**: Monitorear métricas del negocio, ingresos y operaciones de IA

## 📱 Plataformas

| Plataforma | Tecnología | Puerto/URL |
|---|---|---|
| Web | React + Vite + TailwindCSS | http://localhost:5173 |
| Backend API | Node.js + Express + TypeScript | http://localhost:8080 |
| Mobile | React Native + Expo | Expo Go App |

## 🏗️ Arquitectura

```
ofiai/
├── backend/    # API REST Node.js + Express + TypeScript
├── web/        # Aplicación Web React + Vite + TailwindCSS
├── mobile/     # App Móvil React Native + Expo
├── shared/     # Reglas Firebase, configuración compartida
└── docs/       # Documentación completa del proyecto
```

## 👤 Roles de Usuario

- **Empresa** (`empresa`): Publica trabajos y contrata profesionales
- **Profesional** (`profesional`): Ofrece servicios y envía propuestas
- **Administrador** (`admin`): Gestiona la plataforma y monitorea métricas

## ⚡ Inicio Rápido

### Prerrequisitos
- Node.js 20+
- npm o yarn
- Cuenta en Firebase
- API Key de Google Gemini

### Backend
```bash
cd backend
cp .env.example .env
# Configura las variables en .env
npm install
npm run dev
```

### Web
```bash
cd web
npm install
npm run dev
```

### Mobile
```bash
npm install
npx expo start
```

## 🤖 Agentes de IA (Google Gemini)

| Agente | Función |
|---|---|
| Intake Agent | Procesa y estructura requerimientos de empresas |
| Matching Agent | Empareja empresas con profesionales compatibles |
| Pricing Agent | Estima precios de mercado LATAM |
| Coordinator Agent | Coordina flujos entre agentes |
| Reputation Agent | Analiza y calcula puntajes de reputación |
| Sales Agent | Asiste en conversión de leads |
| Support Agent | Atención al cliente con IA |
| Analytics Agent | Genera insights del negocio |

## 💳 Planes SaaS

| Plan | Precio/mes | Para |
|---|---|---|
| Básico | $29 USD | Pequeñas empresas |
| Pro | $79 USD | Empresas medianas |
| Enterprise | $199 USD | Grandes empresas |

## 🌎 Países Soportados

México 🇲🇽 · Colombia 🇨🇴 · Chile 🇨🇱 · Argentina 🇦🇷 · Perú 🇵🇪 · Ecuador 🇪🇨 · Venezuela 🇻🇪 · Bolivia 🇧🇴 · Paraguay 🇵🇾 · Uruguay 🇺🇾

## 📚 Documentación

Ver carpeta [`docs/`](./docs/) para documentación completa.

## 📄 Licencia

MIT License - Ver [LICENSE](./LICENSE)
