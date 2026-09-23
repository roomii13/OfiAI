# OfiAI - Agentes de Inteligencia Artificial

## Arquitectura de Agentes

OfiAI utiliza múltiples agentes especializados basados en Google Gemini API, coordinados por un agente orquestador central.

## Agentes Implementados (Fase 1 - Base)

### Intake Agent (`intake.agent.ts`)
- **Función**: Recibe y estructura requerimientos de empresas
- **Input**: Descripción libre del trabajo
- **Output**: Objeto estructurado con categoría, habilidades, presupuesto estimado
- **Modelo**: Gemini 1.5 Pro

### Matching Agent (`matching.agent.ts`)
- **Función**: Calcula compatibilidad entre empresa y profesional
- **Input**: Requerimiento de trabajo + Perfil del profesional
- **Output**: Puntaje de compatibilidad 0-100 + justificación
- **Modelo**: Gemini 1.5 Pro

### Pricing Agent (`pricing.agent.ts`)
- **Función**: Estima precios de mercado para trabajos
- **Input**: Tipo de trabajo + ciudad + materiales + días
- **Output**: Rango de precio min-max en moneda local
- **Modelo**: Gemini 1.5 Flash (velocidad sobre precisión)

## Flujo de Agentes

```
Empresa publica trabajo
    ↓
[Intake Agent] → Estructura el requerimiento
    ↓
[Pricing Agent] → Estima presupuesto si no fue definido
    ↓
[Matching Agent] → Busca profesionales compatibles
    ↓
Notificación a profesionales recomendados
    ↓
Profesional envía propuesta
    ↓
[Coordinator Agent] → Gestiona el proceso de contratación
```

## Preparación para Vertex AI Agents

La arquitectura está diseñada para migrar de Gemini API directo a Vertex AI Agents:
- Cada agente tiene su propio archivo con interfaz clara
- Los prompts están centralizados en `ai/prompts/`
- Las herramientas en `ai/tools/` son agnósticas al orquestador

## Prompts y Evaluación

Los prompts detallados viven en `PromptEngineering.md` y en `backend/src/ai/prompts/ofiai.prompts.ts`.

Métricas iniciales:

- Aceptación del top 3 de matching.
- Precisión de categoría clasificada.
- Tiempo hasta contratación.
- Correcciones manuales de ranking.
- Conversaciones resueltas sin escalamiento humano.
