# OfiAI - Guía de Testing

## Estrategia de Tests

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

## TODO: Configurar Jest con ts-jest
## TODO: Configurar mocks de Firebase Admin SDK
## TODO: Configurar mocks de Gemini API
## TODO: Agregar tests de los validadores Zod
## TODO: Agregar tests de los middlewares de auth y roles
