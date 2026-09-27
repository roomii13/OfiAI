# API

## Agentes y operaciones (27/09/2026)

Las rutas nuevas /sales, /marketing, /support, /intelligence, /agents, /knowledge,
/governance y /admin/operations estan documentadas con metodos y permisos en
[Agentes comerciales y operaciones](docs/BusinessAgents.md#endpoints-nuevos).
Compilacion validada; pruebas funcionales y de autorizacion aplazadas en esta entrega.

Base URL local: `http://localhost:8080/api/v1`.

Todas las rutas privadas esperan `Authorization: Bearer <firebase-id-token>`. El backend entrega `customToken` en login/registro y el cliente debe intercambiarlo por ID token con Firebase cuando use endpoints protegidos.

## Health

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| `GET` | `/health` | No | Estado general y readiness segura sin exponer secretos |
| `GET` | `/health/liveness` | No | Confirma que el proceso HTTP está vivo |
| `GET` | `/health/readiness` | No | Verifica configuración productiva obligatoria |

## Auth

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| `POST` | `/auth/register/company` | No | Registro de empresa |
| `POST` | `/auth/register/professional` | No | Registro de profesional |
| `POST` | `/auth/login` | No | Login y emisión de custom token |
| `POST` | `/auth/recover-password` | No | Recuperación de contraseña |
| `POST` | `/auth/logout` | Sí | Revocación de sesión |
| `GET` | `/auth/me` | Sí | Perfil autenticado |

## Dashboard

| Método | Ruta | Roles |
|---|---|---|
| `GET` | `/dashboard/company` | `empresa`, `admin` |
| `GET` | `/dashboard/professional` | `profesional`, `admin` |
| `GET` | `/dashboard/admin` | `admin` |

Incluye KPIs, estadísticas, actividad reciente, resumen de trabajos y métricas por rol.

## IA

| Método | Ruta | Roles | Uso |
|---|---|---|---|
| `POST` | `/ai/matching` | `empresa`, `admin` | Ranking de profesionales |
| `POST` | `/ai/recommendations` | `empresa`, `admin` | Recomendaciones ordenadas |
| `POST` | `/ai/classify` | `empresa`, `admin` | Clasificación automática |
| `POST` | `/ai/pricing` | autenticado | Estimación de precio |
| `POST` | `/ai/chat` | autenticado | Chat IA con fallback por reglas |

## Jobs

| Método | Ruta | Roles |
|---|---|---|
| `GET` | `/jobs` | autenticado |
| `POST` | `/jobs` | `empresa`, `admin` |
| `GET` | `/jobs/:id` | autenticado |
| `PUT` | `/jobs/:id` | `empresa`, `admin` |
| `DELETE` | `/jobs/:id` | `empresa`, `admin` |

## Matching de un Job

Estas rutas adicionales usan la base /api/v1, Firebase ID token y rol empresa, con ownership del Job.

| Metodo | Ruta | Uso |
|---|---|---|
| POST | /jobs/:jobId/matching | Ejecutar o reutilizar cache; cuerpo {} |
| GET | /jobs/:jobId/matches | Leer resultados/progreso sin llamar a Gemini |
| GET | /jobs/:jobId/matches/:professionalId/profile | Perfil publico del candidato vigente |
| POST | /jobs/:jobId/matches/:professionalId/select | Cuerpo {"runId":"uuid"}; guarda selected, no contrata |
| POST | /jobs/:jobId/matches/events | Cuerpo {"type":"match_viewed","runId":"uuid"} |

Contrato, cache, errores y seguridad: [Matching Agent](docs/MatchingAgent.md).

## Professionals

| Método | Ruta | Roles |
|---|---|---|
| `GET` | `/professionals` | autenticado |
| `POST` | `/professionals` | `profesional`, `admin` |
| `GET` | `/professionals/me/profile` | `profesional`, `admin` |
| `GET` | `/professionals/:id` | autenticado |
| `PUT` | `/professionals/:id` | `profesional`, `admin` |

## Suscripciones

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | No | Lista planes |
| `POST` | `/subscriptions/checkout` | Sí | Checkout Mercado Pago o plan gratuito |
| `GET` | `/subscriptions/me` | Sí | Suscripción vigente |
| `GET` | `/subscriptions/history` | Sí | Historial |
| `POST` | `/subscriptions/:id/cancel` | Sí | Cancelación |
| `POST` | `/subscriptions/:id/renew` | Sí | Renovación manual |
| `POST` | `/subscriptions/webhooks/mercadopago` | Firma MP | Webhook Mercado Pago |

## Notificaciones

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| `POST` | `/notifications` | Sí | Crear notificación |
| `GET` | `/notifications` | Sí | Listar internas |
| `POST` | `/notifications/:id/read` | Sí | Marcar como leída |

## Analytics

| Método | Ruta | Roles | Uso |
|---|---|---|---|
| `POST` | `/analytics/events` | autenticado | Registrar evento |
| `GET` | `/analytics/kpis` | `admin` | KPIs globales |
| `GET` | `/analytics/usage` | `admin` | Uso de plataforma |
| `POST` | `/analytics/reports` | `admin` | Generar reporte |
| `GET` | `/analytics/reports/:id/export` | `admin` | Exportar JSON o CSV |

## Coordinator

Prefijo `/api/v1`, Firebase Auth y ownership en cada operacion.
- `GET /coordinator?cursor=...`: bandeja propia empresa/profesional.
- `GET /jobs/:id/coordinator`: Job autorizado, workflow, proxima accion e historial.
- `POST /jobs/:id/coordinator`: inicia con `{ idempotencyKey, acknowledgeEstimate: true }`.
- `POST /jobs/:id/coordinator/commands`: `{ workflowId, revision, idempotencyKey, action, quote?, schedule?, note? }`.

Los comandos no aceptan estados arbitrarios. Contratos completos: [Coordinator](docs/CoordinatorAgent.md).

## Tareas programadas

| Método | Ruta | Roles | Uso |
|---|---|---|---|
| `GET` | `/scheduler/status` | `admin` | Estado de tareas |
| `POST` | `/scheduler/run` | `admin` | Ejecutar tarea puntual |
