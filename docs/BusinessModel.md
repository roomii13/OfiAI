# OfiAI - Modelo de Negocio

## Modelo de Monetización: SaaS + Comisión

### 1. Suscripciones SaaS (Ingresos Recurrentes)

| Plan | Precio Mensual | Target |
|---|---|---|
| FREE | USD 0 | Empresas y profesionales, cuotas iniciales |
| PRO | USD 3 | Profesionales, 50 propuestas/mes |
| PRO+ | USD 59 | Profesionales, propuestas sin limite |
| BUSINESS | USD 20 | Empresas, hasta 10 trabajos/mes |
| BUSINESS PRO | USD 79 | Empresas, hasta 40 trabajos/mes |
| ENTERPRISE | USD 149 | Empresas, trabajos sin limite |

Precios del catalogo `backend/src/constants/billing.ts` para nuevas contrataciones.
Los cobros en ARS usan la cotizacion de Mercado Pago con cache de una hora, o
`BILLING_USD_TO_ARS` como alternativa manual. Se necesitan credenciales y URL publica
del webhook. Los contratos existentes conservan su importe pactado; si el importe
mostrado cambia antes del checkout, se requiere otra confirmacion.

### 2. Comisión por Trabajo Completado
- 5-8% sobre el valor del trabajo completado
- Solo aplica cuando hay transacción dentro de la plataforma

### 3. Servicios Premium de IA
- Consultas adicionales de IA más allá del límite del plan
- $0.50 USD por consulta adicional de Gemini API

## Proyección de Ingresos (Año 1)

| Mes | Empresas | Profesionales | MRR Estimado |
|---|---|---|---|
| 1-3 | 20 | 50 | $600 USD |
| 4-6 | 100 | 300 | $3,500 USD |
| 7-9 | 300 | 1,000 | $12,000 USD |
| 10-12 | 600 | 2,500 | $28,000 USD |

## Mercado Objetivo LATAM

- **TAM** (Mercado Total Disponible): $2.8B USD
- **SAM** (Mercado Disponible Accesible): $280M USD
- **SOM** (Mercado Obtenible): $28M USD (primeros 3 años)

## Competidores y Adquisición

Competidores indirectos: marketplaces generalistas, agencias locales, grupos de mensajería y referencias informales.

Estrategia inicial:

- Captación de empresas con necesidad recurrente de mantenimiento.
- Onboarding de profesionales verificados por ciudad.
- Referidos entre profesionales con buena reputación.
- Contenido local por categoría de oficio y país.
