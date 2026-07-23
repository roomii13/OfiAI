# OfiAI - Arquitectura del Sistema

## Diagrama de Alto Nivel

```
[Web React] ──────────────────────────────────────────────────────┐
[App Expo] ──────────────┬────────────────────────────────────────► [API REST]
                         │                                         │  Node.js
                    [Firebase Auth]                                │  Express
                                                                   │  TypeScript
                                                                   │
                                                        ┌──────────┴──────────┐
                                                        │                     │
                                              [Firebase Firestore]   [Google Gemini API]
                                              [Firebase Storage]     [Vertex AI (futuro)]
```

## Capas de la Arquitectura Backend

```
Routes → Controllers → Services → Repositories → Database (Firestore)
                     ↘ AI Agents → Integrations/Gemini
                     ↘ Workers (async)
                     ↘ Events → Workers → Notifications
```

## Principios Arquitectónicos

1. **Separación de Responsabilidades**: Cada capa tiene una responsabilidad única
2. **Bajo Acoplamiento**: Las capas se comunican solo con la inmediata siguiente
3. **Capa de Integraciones**: Todos los servicios externos pasan por `integrations/`
4. **Domain-Driven Design**: La carpeta `domain/` encapsulará la lógica de negocio
5. **Event-Driven**: Los eventos en `events/` desacoplan operaciones asíncronas
6. **Observabilidad**: Monitoring, tracing y logging centralizados

## Decisiones de Tecnología

| Decisión | Tecnología | Razón |
|---|---|---|
| Backend | Node.js + Express + TypeScript | Ecosistema amplio, tipado fuerte |
| Base de Datos | Firebase Firestore | Tiempo real, escalable, sin servidor |
| Auth | Firebase Authentication | Integración nativa, segura |
| IA | Google Gemini API | Mejor desempeño en español LATAM |
| Pagos | Stripe | Estándar de la industria SaaS |
| Emails | Resend | API moderna, mejor deliverability |
| Cloud | Google Cloud Run | Escalado automático, pago por uso |
| Cache | Redis (futuro) | Reducir latencia y costos de BD |
