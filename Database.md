# Database

OfiAI usa Firestore como base transaccional principal. Los modelos historicos guardan fechas como `Date`/Timestamp; matching usa ISO UTC para corridas/resultados y Timestamp para eventos.

## Base Configurada

El proyecto `ofiai-2f357` tiene una base Firestore Native con ID `default`
(sin parentesis), en `southamerica-west1`. No es la base predeterminada
`(default)` que los SDK seleccionan cuando se omite el identificador.

- Backend: `FIREBASE_DATABASE_ID=default`.
- Web: `VITE_FIREBASE_DATABASE_ID=default`.
- `shared/firebase.json` apunta reglas e indices a esa misma base.
- Mobile consume la base a traves de la API, sin un cliente Firestore propio.

La comprobacion inicial encontro Authentication sin configurar. En la validacion de Matching del 23/09/2026 ya funcionaron la cuenta empresa demo, la consulta de profesionales y la persistencia real de Jobs/resultados/seleccion. El Job temporal de prueba se elimino sin alterar perfiles existentes.

## Matching Persistido

- jobs/{jobId}/matching/current: estado de corrida, lease, TTL, hashes internos, progreso y metricas.
- jobs/{jobId}/matches/{professionalId}: perfil publico, score, razones, preocupaciones, distancia y estado selected/recommended.
- jobs/{jobId}.matchingSelection: estado previo a Pricing/Coordinator; no asigna profesionalAsignadoId.
- analytics_events: eventos matching_started/completed/failed/fallback_used, vistas y seleccion.

No se guardan prompts completos ni respuestas crudas de Gemini. Subcolecciones accesibles solo por backend; no se desplegaron reglas remotas en esta fase.
Modelo completo y consistencia: [Matching Agent](docs/MatchingAgent.md).

## Colecciones

| Colección | Uso |
|---|---|
| `users` | Usuario base, rol, país, idioma, estado |
| `companies` | Perfil de empresa, industria, ciudad, métricas |
| `professionals` | Perfil profesional, especialidades, disponibilidad, reputación |
| `jobs` | Solicitudes de trabajo, estado, presupuesto, IA |
| `subscriptions` | Suscripción vigente e histórica por usuario |
| `historial_suscripciones` | Eventos operativos y webhooks de suscripción |
| `notifications` | Notificaciones internas y estado de reintentos |
| `analytics_eventos` | Eventos de producto y operación |
| `analytics_reportes` | Reportes generados/exportables |

## Modelo de Usuario

Campos principales:

- `id`
- `email`
- `nombre`
- `apellido`
- `telefono`
- `rol`: `empresa`, `profesional`, `admin`
- `pais`
- `idioma`
- `activo`
- `emailVerificado`
- `fechaCreacion`
- `fechaActualizacion`
- `ultimoAcceso`

## Trabajos

Campos principales:

- `empresaId`
- `titulo`
- `descripcion`
- `categoria`
- `subcategoria`
- `habilidadesRequeridas`
- `presupuestoMinimo`
- `presupuestoMaximo`
- `moneda`
- `tipoTrabajo`
- `ciudad`
- `estado`
- `profesionalAsignadoId`
- `puntajeMatchingIA`
- `profesionalesRecomendados`
- `presupuestoSugeridoIA`
- `adjuntos`
- `historialEstados`

Índices recomendados:

- `jobs`: `empresaId`, `estado`, `fechaCreacion desc`
- `jobs`: `categoria`, `ciudad`, `estado`
- `jobs`: `profesionalAsignadoId`, `estado`

## Profesionales

Campos principales:

- `usuarioId`
- `nombre`
- `apellido`
- `especialidades`
- `categorias`
- `aniosExperiencia`
- `tarifaHora`
- `tarifaServicio`
- `moneda`
- `disponible`
- `pais`
- `ciudad`
- `zonaCobertura`
- `calificacionPromedio`
- `totalResenas`
- `totalTrabajos`
- `verificado`
- `puntajeReputacionIA`
- `certificaciones`
- `disponibilidadHoraria`

Índices recomendados:

- `professionals`: `disponible`, `ciudad`, `calificacionPromedio desc`
- `professionals`: `categorias array-contains`, `disponible`
- `professionals`: `usuarioId`

## Suscripciones

Campos principales:

- `usuarioId`
- `plan`: `gratuito`, `profesional`, `empresa`
- `estado`
- `fechaInicio`
- `fechaFin`
- `fechaRenovacion`
- `mercadoPagoPreapprovalId`
- `mercadoPagoPreferenceId`
- `mercadoPagoPaymentId`
- `canceladaEn`
- `metadata`

Índices recomendados:

- `subscriptions`: `usuarioId`, `estado`, `fechaCreacion desc`
- `subscriptions`: `mercadoPagoPreapprovalId`

## Notificaciones

Campos principales:

- `usuarioId`
- `canal`: email, whatsapp, push, interna
- `plantilla`
- `estado`
- `intentos`
- `maxIntentos`
- `destinatario`
- `programadaPara`
- `proximoReintento`
- `metadata`

Índices recomendados:

- `notifications`: `estado`, `proximoReintento`
- `notifications`: `usuarioId`, `fechaCreacion desc`

## Analytics

Eventos mínimos:

- `usuario_registrado`
- `trabajo_publicado`
- `matching_ejecutado`
- `checkout_creado`
- `suscripcion_renovada`
- `notificacion_enviada`

Los reportes guardan parámetros, rango, métricas agregadas y formato de exportación.
