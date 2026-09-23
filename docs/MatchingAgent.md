# Fase 5: Matching Agent

Validacion local: 23/09/2026. Implementacion sobre la arquitectura existente.

## Estado

El flujo Job -> candidatos reales -> filtros -> scoring -> recomendaciones persistidas -> perfil -> selected funciona.
No equivale a contratacion, asignacion del Job, pago, contacto o coordinacion automatica.

Verificado con Firestore real `ofiai-2f357 / default`: se creo un Job temporal mediante API autenticada, se obtuvo un candidato existente (81.25% por reglas), se consulto su perfil publico, se guardo selected y el Job aparecio en el dashboard.
El estado comercial permanecio publicado y profesionalAsignadoId no se asigno.
El Job temporal, un resultado y seis eventos propios de esa prueba se eliminaron al terminar; no se modificaron perfiles ni trabajos anteriores.

**La fase no se declara validada integralmente en produccion**: Gemini responde HTTP 402 RESOURCE_EXHAUSTED con mensaje de creditos/prepago; falta comprobar respuesta semantica real cuando Google permita generacion. La clave no se mostro ni se cambio, y no se modifico facturacion.
El usuario indico plan gratuito: comprobar la correspondencia entre clave, proyecto Gemini y plan en AI Studio antes de asumir que requiere un plan pago.
La interfaz funciona con fallback explicito y no simula respuestas de Gemini.

## Arquitectura

- Se amplian matching.agent.ts y ranking.tool.ts existentes. No se crea otro cliente Gemini.
- MatchingService recibe el ID de un Job persistido; nunca acepta companyId ni perfiles del frontend.
- Repositorios existentes de Jobs, empresas y profesionales resuelven ownership y acceso a Firestore.
- MatchingRepository conserva corrida, resultados, seleccion y eventos atomicos.
- El evento job.created llama al worker existente despues de guardar el Job, tanto en alta manual como en confirmacion de Intake.
- La ejecucion inicial es sincrona y acotada. Un fallo de matching no deshace un Job ya publicado.
- Intake estructura/publica; Matching analiza candidatos independientemente.
- Las rutas antiguas /ai/matching y /ai/recommendations siguen disponibles con su contrato previo y reutilizan el motor determinista. Las nuevas pantallas usan exclusivamente las rutas de Job de esta fase.
- No se modificaron suscripciones, renovaciones, Mercado Pago ni modulos de coordinacion/pagos.

## Algoritmo

1. Lectura por paginas con proyeccion explicita de campos profesionales, sin datos bancarios, documentos, UID ni contactos.
2. Estado active; perfiles legados sin status se consideran activos salvo activo=false.
3. Categorias y habilidades con normalizacion de acentos y sinonimos centralizados. Categorias personalizadas continuan siendo texto libre.
4. Exclusiones: categoria incompatible, inactive/suspended, pais diferente en trabajos presenciales, fuera del radio declarado, indisponibilidad explicita en trabajos urgentes.
5. Distancia Haversine cuando existen ambas coordenadas; distancia desconocida se muestra como desconocida, no como cero.
6. Disponibilidad por booleano y dia de fechas absolutas. Las fechas relativas no se interpretan arbitrariamente.
7. Score determinista 0..100; los datos ausentes no obtienen puntos inventados.
8. Gemini recibe un maximo de 20 candidatos prefiltrados. Su resultado nunca reincorpora candidatos descartados.
9. Score final: 80% determinista + 20% semantico. Ante fallo se usa 100% determinista.
10. Desempate estable por ID y explicaciones trazables.

Pesos centralizados en backend/src/constants/matching.ts:

| Criterio | Peso |
|---|---:|
| Categoria | 30 |
| Habilidades | 20 |
| Ubicacion | 15 |
| Disponibilidad | 10 |
| Experiencia | 10 |
| Valoracion con resenas | 5 |
| Trabajos completados | 5 |
| Tasa de respuesta | 5 |

Limites actuales: paginas de 250, maximo 1000 perfiles revisados, 20 resultados. Si se alcanza el limite se informa searchLimited en ambas interfaces.
Antes de superar ese volumen conviene agregar una estrategia indexada de descubrimiento por categoria y geografia; no se declara cobertura de todo el catalogo al alcanzar el limite.
El precio del perfil sirve para filtrar y advertir desajustes; no se fabrica una cotizacion ni se convierte moneda.

## Endpoints

Base existente: /api/v1. Todos requieren Firebase ID token y rol empresa.

| Metodo | Ruta | Cuerpo |
|---|---|---|
| POST | /jobs/:jobId/matching | {} |
| GET | /jobs/:jobId/matches | Sin cuerpo |
| GET | /jobs/:jobId/matches/:professionalId/profile | Sin cuerpo |
| POST | /jobs/:jobId/matches/:professionalId/select | {"runId":"UUID de la corrida"} |
| POST | /jobs/:jobId/matches/events | {"type":"match_viewed","runId":"UUID de la corrida"} |

Respuesta estandar: {"exito":true,"datos":...}.
401 sin autenticacion; 403 por rol; 404 para Job inexistente/ajeno; 400 por parametros invalidos; 409 por corrida o seleccion desactualizada; 503 por fallo de infraestructura.
Los errores internos y las respuestas crudas del proveedor no se entregan al cliente.
Un Job cancelado/completado no habilita estas acciones.
El limitador IA existente protege los POST. No se acepta companyId, score o estado de seleccion enviados por el cliente.

## Firestore

- jobs/{jobId}/matching/current: runId, companyId interno, status, completedStages, fingerprint del Job, configVersion, leaseUntil, profileVersions, contadores, promedio, motor utilizado, generatedAt, expiresAt y selectedProfessionalId.
- jobs/{jobId}/matches/{professionalId}: snapshot publico del perfil, deterministicScore, semanticScore nullable, matchScore, distanceKm nullable, reason, strengths, concerns, recommended, state y runId.
- jobs/{jobId}: matchingStatus y matchingSelection; mantiene profesionalesRecomendados y puntajeMatchingIA para dashboards existentes.
- analytics_events/{id}: eventos agregables, sin prompts ni contenido de conversaciones.

MatchingSelection:
```json
{
  "status": "selected",
  "professionalId": "id",
  "runId": "uuid",
  "jobFingerprint": "sha256",
  "selectedAt": "fecha ISO"
}
```

Fechas de corridas/resultados/seleccion: ISO UTC. Eventos: Date serializado como Timestamp por Firestore.
No se almacenan prompts ni respuestas crudas de Gemini.
Las reglas locales deniegan acceso directo de SDK cliente a las dos subcolecciones; acceso via backend con ownership. No se desplegaron reglas remotas en esta fase.

## Cache y Consistencia

- TTL por defecto 1800 segundos; GET nunca llama a Gemini.
- POST reutiliza cache valido. Cambios en requisitos, politica/configuracion/prompt, estado o perfil de candidato invalidan los resultados.
- Se revalidan los perfiles antes de mostrarlos y nuevamente dentro de la transaccion de seleccion.
- Lease de 90 segundos evita llamadas simultaneas duplicadas; timeout Gemini 30 segundos.
- Las pantallas consultan progreso real cada 3 segundos mientras se procesa y acotan su espera a 75 segundos.
- Estados: pending, processing, completed, failed, fallback.
- Seleccion atomica: solo un candidato selected por corrida, sin modificar el estado comercial del Job.
- Cambiar requisitos del Job limpia la seleccion. Nuevos profesionales fuera de los resultados guardados se incorporan al vencer el TTL.
- Cambiar filtros u orden es local; no ejecuta otra llamada de IA.

## Gemini

Prompt: backend/src/ai/prompts/matching.prompt.ts.
Version: MATCHING_PROMPT_VERSION = 1.0.0.
Agente: MatchingAgent.analyze, independiente de Intake.
Cliente: GeminiClient.generarEstructurado existente, extendido con opciones opcionales de modelo y timeout.

Salida exigida: matches con professionalId, semanticScore, reason, strengths, concerns y recommended.
Zod valida limites, tipos, atributos permitidos, IDs existentes y ausencia de duplicados/omisiones.
Se envian categoria, descripcion, capacidades, experiencia, ubicacion aproximada, disponibilidad e historial resumido.
No se envian nombre/foto/UID/contactos, coordenadas exactas, banco, documentos, tokens ni claves.
El texto de usuarios se trata como datos no confiables y el prompt prohibe inventar atributos o alterar filtros.
El schema valida estructura y correspondencia de candidatos, no garantiza por si solo veracidad semantica: las reglas y la evidencia del perfil siguen siendo la base.

No se llama a Gemini sin candidatos, si el Job no contiene datos suficientes o si hay cache reciente.
La comprobacion real del proveedor devolvio 402 el 23/09/2026. La API habilitada no demuestra cuota de generacion disponible.

## Variables Nuevas

Solo backend; incluidas en backend/.env.example. No es necesario agregar secretos nuevos.

| Variable | Valor predeterminado |
|---|---|
| GEMINI_MATCHING_MODEL | gemini-3.6-flash |
| GEMINI_MATCHING_ENABLED | true |
| MATCHING_CACHE_TTL_SECONDS | 1800 |

Se reutiliza GEMINI_API_KEY existente exclusivamente en backend.
No se modifico el .env local ni se introdujeron variables Gemini en web/mobile.
Los builds web y Android se inspeccionaron: no contienen la clave Gemini configurada.
Las claves publicas de configuracion Firebase continuan siendo parte normal del SDK cliente; no son la clave Gemini ni una cuenta de servicio.

## Interfaces

Web: /dashboard/company/jobs/:jobId/matches, enlazada desde Trabajos, dashboard y confirmacion de Intake.
Mobile: JobMatchesScreen, accesible desde Trabajos y confirmacion de Intake; autorizada solo a empresas.
Incluye resumen del Job, carga/progreso/espera larga, error/reintento, estado vacio, candidatos, explicaciones, perfil y selected.
Web y mobile filtran por distancia, experiencia, rating, disponibilidad, precio/moneda y categoria; ordenan sin consultar Gemini.
Las fotos solo usan URLs publicadas por el profesional; si no existen se muestran iniciales, no retratos inventados.
Ampliar radio queda visible como accion no disponible para la siguiente etapa.

## Eventos

matching_started, matching_completed, matching_failed, matching_fallback_used, match_viewed, professional_profile_viewed, professional_selected.

Metadata: matching_duration (ms), candidates_found, matches_returned, average_match_score, semantic_matching_used, fallback_used y professional_selected.
Vistas idempotentes por corrida/perfil. IDs internos solo para correlacion, sin datos personales innecesarios.

## Validacion Ejecutada

| Comprobacion | Resultado |
|---|---|
| Backend TypeScript/build | OK |
| Backend lint | OK |
| Backend Jest (13 suites) | 91/91 |
| Web TypeScript/Vite build | OK |
| Web lint | OK |
| Web Vitest (6 archivos) | 45/45 |
| Mobile TypeScript | OK |
| Mobile Jest Expo (2 archivos) | 8/8 |
| Expo export Android | OK |
| Firestore real: Job, matching, perfil, selected, dashboard | OK con fallback |
| Web real en navegador aislado | Perfil del catalogo abre correctamente |
| Flujo visual con respuestas controladas | Filtros, orden, perfil, seleccion; cero recalculos por filtrar |
| Viewports 1440, 768, 390, 320 px | Sin desbordamiento ni errores JS |
| Clave Gemini en bundles web/Android (12 archivos) | No encontrada |

Total: 144 tests; 44 casos adicionales respecto del estado previo.
Las pruebas HTTP usan servicios/repositorios reales con un adaptador transaccional en memoria, no el emulador de reglas.
El bundle Android se genero con Node 20 por compatibilidad con Expo 50 existente; backend/web se comprobaron con Node 24.
No hay dispositivo conectado en adb: falta validar Android/iOS en hardware.

Comandos desde cada carpeta correspondiente:
```powershell
# backend, con Node moderno
npm run build
npm run lint
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand

# web
npm run build
npm run lint
npm test

# mobile
npm run typecheck
npm test
# Ejecutar con Node 20 para la version actual de Expo.
npx expo export --platform android
```

## Seed

No se agregaron profesionales falsos al catalogo real.
backend/tests/matching-fixtures.ts contiene 12 oficios sinteticos: Electricista, Plomero, Gasista, Albanil, Pintor, Carpintero, Programador, Disenador, Fotografo, Tecnico HVAC, Limpieza y Jardinero.
Los tests agregan tambien electricistas lejanos, inactivos y suspendidos.
La verificacion Firebase utilizo el perfil demo ya existente, sin alterar su identidad ni reputacion.
Las capturas de varios candidatos usan fixtures aislados del navegador, no respuestas reales de Gemini.

## Como Probar

1. Iniciar la API y Vite con los .env existentes; entrar como empresa en http://localhost:5173.
2. Publicar una solicitud manual o confirmar el resumen de Intake. El Job debe estar publicado antes de hacer matching.
3. Entrar a Trabajos y pulsar Ver candidatos, o Ver profesionales recomendados al terminar Intake.
4. Revisar el resumen y la explicacion; probar filtros y orden. Esas acciones no deben producir POST /matching.
5. Abrir Ver perfil y Seleccionar profesional. Debe verse selected sin profesionalAsignadoId ni cambio de estado comercial.
6. Volver a abrir la pantalla: recupera cache mientras Job/perfiles/TTL no cambien.
7. Con GEMINI_MATCHING_ENABLED=false, reiniciar solo la API y verificar el mensaje de criterios de compatibilidad. Restaurar true para probar el proveedor real cuando se resuelva su acceso.

No dejar habilitadas tareas de prueba ni modificar renovaciones para comprobar este flujo.
La API de vista previa local se inicio con scheduler desactivado solo en su proceso, sin modificar variables persistidas.

## Pendientes para Pricing y Coordination

- Consumir MatchingSelection con nueva validacion de Job, candidato, corrida y condiciones vigentes.
- Pricing: cotizacion real, moneda, alcance y aprobacion explicita.
- Coordinator: contacto, negociacion y coordinacion con consentimiento, idempotencia y estados propios.
- Cola durable para job.created si se requiere ejecucion distribuida. Hoy el endpoint espera al worker.
- Expansion de radio y descubrimiento indexado para catalogos mayores.
- Feedback y evaluacion offline del prompt con proveedor disponible.
- Ningun evento actual autoriza cobros, mensajes, WhatsApp, ordenes ni contrataciones.

## Problemas y Limites

- Gemini 402 sigue siendo un bloqueo externo para demostrar matching semantico real.
- Prueba fisica Expo, emulador/deploy de reglas y despliegue Cloudflare pendientes; no se hicieron cambios de infraestructura en esta fase.
- El repo mantiene deuda previa de dependencias/Expo y despliegue. Esta fase no constituye una auditoria global de produccion.
- Vite advierte bundle principal aproximado de 760 KB y uso previo de __dirname en su configuracion.
- Reglas preexistentes de profesionales permiten lectura autenticada amplia fuera de estos endpoints. Revisar esa politica antes de publicar campos privados en el documento base; el matching usa proyeccion publica y deniega acceso directo a sus subcolecciones.
- La cuenta de servicio usa Admin SDK: las pruebas reales de backend no sustituyen pruebas de reglas cliente.
- La busqueda de 1000 perfiles es una cota explicita, no una garantia de exhaustividad del catalogo.
- Se conservaron cambios previos del repositorio. No se renombraron archivos ni reorganizaron carpetas.

## Archivos Creados (23)

- `backend/src/ai/prompts/matching.prompt.ts`
- `backend/src/ai/tools/distance.tool.ts`
- `backend/src/constants/matching.ts`
- `backend/src/controllers/matching.controller.ts`
- `backend/src/domain/matching/matching.ts`
- `backend/src/events/matching.event.ts`
- `backend/src/models/matching.model.ts`
- `backend/src/repositories/matching.repository.ts`
- `backend/src/services/matching.service.ts`
- `backend/src/validators/matching.validator.ts`
- `backend/tests/api/matching.test.ts`
- `backend/tests/matching-fixtures.ts`
- `backend/tests/unit/matching-agent.test.ts`
- `backend/tests/unit/matching.test.ts`
- `docs/MatchingAgent.md`
- `mobile/src/lib/matching.ts`
- `mobile/src/navigation/JobMatchesScreen.test.tsx`
- `mobile/src/navigation/JobMatchesScreen.tsx`
- `shared/matching.d.ts`
- `web/src/app/JobMatchesPage.test.tsx`
- `web/src/app/JobMatchesPage.tsx`
- `web/src/app/matching.css`
- `web/src/lib/api/matching.ts`

## Archivos Modificados en Esta Fase (34)

La lista distingue modificaciones de esta fase aunque algunos archivos aun no estuvieran versionados antes de iniciarla.

- `AIAgents.md`
- `API.md`
- `Database.md`
- `Deployment.md`
- `PromptEngineering.md`
- `README.md`
- `backend/.env.example`
- `backend/src/ai/agents/matching.agent.ts`
- `backend/src/ai/tools/ranking.tool.ts`
- `backend/src/config/env.ts`
- `backend/src/database/firestore/collections.ts`
- `backend/src/domain/matching/index.ts`
- `backend/src/events/job-created.event.ts`
- `backend/src/integrations/gemini/gemini.client.ts`
- `backend/src/models/Job.ts`
- `backend/src/models/Professional.ts`
- `backend/src/repositories/jobs.repository.ts`
- `backend/src/repositories/professional.repository.ts`
- `backend/src/routes/jobs.routes.ts`
- `backend/src/services/intake.service.ts`
- `backend/src/services/jobs.service.ts`
- `backend/src/services/professional.service.ts`
- `backend/src/validators/professional.validator.ts`
- `backend/src/workers/matching.worker.ts`
- `backend/tests/api/intake.test.ts`
- `backend/tests/intake-fixtures.ts`
- `docs/TestingGuide.md`
- `mobile/src/navigation/IntakeScreen.tsx`
- `mobile/src/navigation/index.tsx`
- `mobile/src/types/index.ts`
- `shared/firestore.rules`
- `web/src/app/IntakePage.tsx`
- `web/src/app/Router.tsx`
- `web/src/layouts/DashboardLayout.tsx`
