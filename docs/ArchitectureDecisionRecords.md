# OfiAI - Architecture Decision Records (ADRs)

Registro de decisiones arquitectónicas importantes tomadas durante el desarrollo.

---

## ADR-001: Firebase como Backend-as-a-Service principal

**Fecha**: 2026-07-20
**Estado**: Aceptado

**Contexto**: Necesitamos una base de datos escalable con soporte para tiempo real, autenticación integrada y almacenamiento de archivos.

**Decisión**: Usar Firebase (Firestore + Auth + Storage) como BaaS principal.

**Consecuencias**:
- ✅ Tiempo de desarrollo más rápido
- ✅ Escalado automático sin configuración de infraestructura
- ✅ Tiempo real nativo en Firestore
- ❌ Vendor lock-in con Google Cloud
- ❌ Costos pueden escalar con el crecimiento

---

## ADR-002: Capa de Integraciones separada

**Fecha**: 2026-07-20
**Estado**: Aceptado

**Contexto**: El proyecto usa múltiples servicios externos (Firebase, Gemini, Stripe, Resend, WhatsApp, Google Maps).

**Decisión**: Crear `src/integrations/` como capa de abstracción dedicada. Los servicios de negocio nunca importan SDKs externos directamente.

**Consecuencias**:
- ✅ Fácil de mockear en tests
- ✅ Posible reemplazar servicios sin tocar lógica de negocio
- ✅ Principio de responsabilidad única
- ❌ Agrega una capa adicional de indirección

---

## ADR-003: Google Gemini API para IA

**Fecha**: 2026-07-20
**Estado**: Aceptado

**Contexto**: Necesitamos un LLM para matching, pricing y análisis. Evaluamos GPT-4 (OpenAI), Claude (Anthropic) y Gemini (Google).

**Decisión**: Usar Google Gemini 1.5 Pro/Flash.

**Razones**:
- Mejor desempeño en español latinoamericano
- Integración nativa con Google Cloud
- Criterio del hackathon (uso de Gemini API)
- Preparado para migrar a Vertex AI Agents

---

## ADR-004: Arquitectura de Agentes IA

**Fecha**: 2026-07-20
**Estado**: Aceptado

**Contexto**: Necesitamos múltiples funcionalidades de IA (matching, pricing, reputación, soporte).

**Decisión**: Implementar agentes IA especializados en `src/ai/agents/` coordinados por un `coordinator.agent.ts`.

**Consecuencias**:
- ✅ Cada agente tiene una responsabilidad clara
- ✅ Fácil de escalar y mejorar individualmente
- ✅ Preparado para Vertex AI Agents
- ❌ Más complejidad inicial

---

## ADR-005: Caché en memoria en desarrollo, Redis en producción

**Fecha**: 2026-07-20
**Estado**: Aceptado

**Contexto**: Necesitamos caché para reducir costos de Gemini API y latencia de Firestore.

**Decisión**: Abstracción `ServicioCache` con implementación en memoria para desarrollo y Redis para producción (cuando `REDIS_ENABLED=true`).

## TODO: Agregar más ADRs conforme se tomen decisiones importantes
