# AI Agents

Los agentes de OfiAI viven en `backend/src/ai/agents`. Se conserva `backend/src/services/ai.service.ts`
para los flujos anteriores; `backend/src/services/orchestrator.service.ts` coordina ahora
eventos y herramientas sobre servicios existentes, sin reemplazar esa arquitectura.

La entrega del 27/09/2026 extiende Sales, Marketing, Support y Analytics, y agrega memoria,
permisos por herramienta y observabilidad. Ver [alcance, prompts y limites](docs/BusinessAgents.md).
Groq es el proveedor principal; DeepSeek/Gemini requieren AI_LEGACY_FALLBACK_ENABLED=true.
El .env local y su ejemplo habilitan AI_BUSINESS_LLM_ENABLED; el valor por defecto del
schema sigue siendo false. Sin clave o cuota se conservan las reglas y consultas
controladas existentes. Intake requiere un proveedor disponible para conversar.
Ver [configuracion y limites de Groq](docs/Groq.md).

## Agentes

| Agente | Archivo | Responsabilidad |
|---|---|---|
| Intake | `intake.agent.ts` | Clasificar solicitudes y detectar atributos operativos |
| Matching | `matching.agent.ts` | Filtros y ranking determinista con enriquecimiento IA validado y fallback |
| Pricing | `pricing.agent.ts` | Rangos sustentados en evidencia comparable, confianza, factores y fallback |
| Support | `support.agent.ts` | Responder chat con fallback determinístico |
| Coordinator | `coordinator.agent.ts` | Decidir el siguiente paso del workflow bilateral persistente, sin inventar consentimientos |
| Reputation | `reputation.agent.ts` | Calcular señales de reputación |
| Sales | `sales.agent.ts` | Apoyar conversión y onboarding |
| Marketing | `marketing.agent.ts` | Preparar mensajes comerciales |
| Analytics | `analytics.agent.ts` | Generar insights de uso y operación |

## Herramientas

| Herramienta | Archivo | Uso |
|---|---|---|
| Ranking | `ranking.tool.ts` | Puntaje por categoría, habilidades, ubicación, disponibilidad, reputación y experiencia |
| Classification | `classification.tool.ts` | Categoría, prioridad, complejidad, habilidades y visita técnica |

## Flujo de Matching

1. La empresa publica o describe un trabajo.
2. Intake estructura categoría, habilidades y complejidad.
3. Matching calcula ranking con reglas propias.
4. El servicio guarda profesionales recomendados y puntaje IA.
5. Groq puede enriquecer la explicacion; si falla se devuelve el ranking determinista. Los proveedores anteriores no se consumen sin opt-in.
6. La empresa consulta perfiles publicos y selecciona un candidato; esta fase no envia notificaciones ni contrata.

La Fase 5 agrega MatchingService, MatchingRepository y endpoints de Job con ownership.
El evento job.created invoca el worker existente despues de publicar el Job; Intake y Matching permanecen independientes.
Contrato, pruebas, limites y handoff selected: [Matching Agent](docs/MatchingAgent.md).

## Flujo de Chat IA

1. Web o mobile llama `/ai/chat`.
2. Backend valida autenticación.
3. Si `usarGemini=true` (nombre heredado del contrato), el backend intenta DeepSeek y luego Gemini.
4. Si ambos fallan, `support.agent.ts` responde con reglas locales.
5. La respuesta incluye acciones sugeridas.

Intake, Matching y Pricing validan el JSON semantico antes de aceptarlo. Una respuesta invalida del
proveedor principal activa el respaldo; nunca se confia en un JSON solo por ser parseable. Las claves
viven en backend y no en React/Expo. El 26-09-2026 ambos proveedores devolvieron HTTP 402 en una
prueba minima: la ruta de fallback esta implementada y probada con transportes simulados, pero el
modelo externo requiere saldo/cuota antes de probar un flujo real de empresa.

## Evolución

Coordinator integra propuestas, notificaciones internas, agenda, Jobs, auditoria y eventos.
La finalizacion deja un evento durable esperando reviews; todavia no actualiza reputacion automaticamente.
Detalle de contratos y verificacion: [Coordinator Agent](docs/CoordinatorAgent.md).

- Guardar feedback de empresas sobre recomendaciones.
- Medir precisión por categoría y país.
- Ajustar pesos del ranking con métricas reales.
- Separar evaluación offline de prompts.
- Preparar migración futura a Vertex AI Agents si el volumen lo justifica.
