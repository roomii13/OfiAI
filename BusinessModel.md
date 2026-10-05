# Business Model

OfiAI monetiza mediante suscripciones SaaS y servicios operativos asociados al marketplace de oficios.

## Planes

| Plan | Precio mensual | Segmento | Capacidades |
|---|---:|---|---|
| FREE | USD 0 | Empresas y profesionales | Cuotas iniciales por segmento |
| PRO | USD 3 | Profesionales | 50 propuestas y 50 consultas IA |
| PRO+ | USD 59 | Profesionales | Propuestas sin limite y 150 consultas IA |
| BUSINESS | USD 20 | Empresas | 10 trabajos y 50 consultas IA |
| BUSINESS PRO | USD 79 | Empresas | 40 trabajos y 200 consultas IA |
| ENTERPRISE | USD 149 | Empresas | Trabajos sin limite y 500 consultas IA |

Catalogo vigente para nuevas contrataciones: `backend/src/constants/billing.ts`.
El importe en ARS se calcula con la cotizacion de Mercado Pago, cacheada una hora.
`BILLING_USD_TO_ARS` permite fijar opcionalmente una conversion manual.
La fuente y fecha son visibles; si cambia el importe, el usuario debe confirmarlo nuevamente.
Sin cotizacion, credenciales o URL del webhook, los planes pagos no se habilitan.
Cambiar el catalogo no modifica automaticamente los contratos existentes.

Los cobros pagos se procesan con Mercado Pago mediante preapprovals mensuales. El plan gratuito se activa internamente sin proveedor externo.

## Ingresos Complementarios

- Comisión por trabajo completado dentro de la plataforma.
- Paquetes de consultas IA adicionales.
- Verificación avanzada de profesionales.
- Reportes premium para empresas.
- Soporte operativo gestionado.

## Métricas Clave

- MRR y ARR.
- Conversión gratuito a pago.
- Trabajos publicados por empresa.
- Tasa de matching exitoso.
- Tiempo medio de cobertura.
- Retención de profesionales.
- Costo por adquisición por país.

## Go To Market

1. Lanzamiento inicial en Argentina con categorías de mantenimiento, instalaciones y tecnología.
2. Captación de empresas medianas con necesidad recurrente de proveedores.
3. Onboarding de profesionales verificados por ciudad.
4. Programa de referidos para profesionales con buena calificación.
5. Expansión a México, Colombia, Chile y Perú.

## Riesgos

- Calidad desigual de profesionales.
- Dependencia de proveedores externos de pagos y mensajería.
- Fricción de verificación en algunos países.
- Precisión insuficiente del matching si no se recolecta feedback.

## Mitigaciones

- Verificación manual y reputación calculada.
- Fallback de reglas cuando Gemini no esté disponible.
- Webhooks idempotentes y trazabilidad de pagos.
- Sistema de reintentos de notificaciones.
- Analytics de calidad por categoría y ciudad.
