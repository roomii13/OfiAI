# AI Agents

Los agentes de OfiAI viven en `backend/src/ai/agents` y son coordinados por `backend/src/services/ai.service.ts`.

## Agentes

| Agente | Archivo | Responsabilidad |
|---|---|---|
| Intake | `intake.agent.ts` | Clasificar solicitudes y detectar atributos operativos |
| Matching | `matching.agent.ts` | Filtros y ranking determinista con enriquecimiento Gemini validado y fallback |
| Pricing | `pricing.agent.ts` | Estimar rangos de precio por categoría y complejidad |
| Support | `support.agent.ts` | Responder chat con fallback determinístico |
| Coordinator | `coordinator.agent.ts` | Ordenar acciones entre módulos |
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
5. Gemini puede enriquecer la explicación si está disponible.
6. La empresa consulta perfiles publicos y selecciona un candidato; esta fase no envia notificaciones ni contrata.

La Fase 5 agrega MatchingService, MatchingRepository y endpoints de Job con ownership.
El evento job.created invoca el worker existente despues de publicar el Job; Intake y Matching permanecen independientes.
Contrato, pruebas, limites y handoff selected: [Matching Agent](docs/MatchingAgent.md).

## Flujo de Chat IA

1. Web o mobile llama `/ai/chat`.
2. Backend valida autenticación.
3. Si `usarGemini=true` y hay API key, Gemini responde con prompt estructurado.
4. Si no, `support.agent.ts` responde con reglas locales.
5. La respuesta incluye acciones sugeridas.

## Evolución

- Guardar feedback de empresas sobre recomendaciones.
- Medir precisión por categoría y país.
- Ajustar pesos del ranking con métricas reales.
- Separar evaluación offline de prompts.
- Preparar migración futura a Vertex AI Agents si el volumen lo justifica.
