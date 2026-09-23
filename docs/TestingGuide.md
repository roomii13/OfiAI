# OfiAI - Guía de Testing

## Estrategia de Tests

Validacion de Matching del 23/09/2026: backend 91 tests, web 45, mobile 8; builds, typecheck, lint backend/web y export Android correctos.
Las pruebas de repositorios usan adaptador transaccional aislado; adicionalmente se probo un Job temporal en Firestore real y se limpio.
No equivalen a emulador de reglas, despliegue Cloudflare o prueba en telefono fisico.
Comandos, evidencia y archivos exactos: [Matching Agent](MatchingAgent.md).

### Pirámide de Tests
1. **Unit Tests** (70%): Servicios, utilidades, validadores
2. **Integration Tests** (20%): Endpoints de API con Firestore
3. **E2E Tests** (10%): Flujos críticos de usuario

## Backend (Jest + ts-jest)

```bash
cd backend
npm test           # Correr todos los tests
npm test -- --watch  # Modo watch
npm test -- --coverage  # Con cobertura
```

### Estructura de Tests
```
backend/src/tests/
├── unit/
│   ├── services/
│   ├── validators/
│   └── utils/
├── integration/
│   ├── auth.test.ts
│   ├── jobs.test.ts
│   └── ai.test.ts
└── fixtures/
    ├── usuarios.fixture.ts
    └── trabajos.fixture.ts
```

## Estado Actual

Jest con ts-jest está configurado en backend.

Suites iniciales:

- Unitarias: herramientas de IA.
- Integración: planes de suscripción.
- API: health check Express.

## Próxima Cobertura

- Validadores Zod críticos.
- Middlewares de auth y roles.
- Repositorios con Firebase Emulator Suite.
- Webhooks de Mercado Pago con payloads firmados.
