# Groq en OfiAI

Integracion del 27/09/2026. Groq es el proveedor principal alojado, exclusivo del backend.
No se instalan modelos locales ni se modifica la arquitectura de agentes.

## Activacion

Crear una clave desde https://console.groq.com/keys y completar GROQ_API_KEY en
backend/.env. No publicarla en chat, Git, VITE_ ni EXPO_PUBLIC_. Reiniciar el backend
despues del cambio. En hosting, configurar el mismo valor como secreto del servidor.

Para evitar cobros, comprobar que la organizacion de Groq pertenece al plan Free.
OfiAI no verifica ni cambia el plan de facturacion de la cuenta. Free tiene cuotas;
no significa servicio ilimitado ni disponibilidad garantizada.

```dotenv
GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_TIMEOUT_MS=30000
GROQ_MAX_OUTPUT_TOKENS=4096
GROQ_MAX_INPUT_CHARACTERS=60000
AI_LEGACY_FALLBACK_ENABLED=false
AI_BUSINESS_LLM_ENABLED=true
```

GROQ_API_KEY ya fue configurada por la usuaria y se verificaron respuestas reales de Intake.
Las claves anteriores se conservaron sin imprimirlas y no se utilizan con el fallback deshabilitado.
El schema mantiene AI_BUSINESS_LLM_ENABLED=false cuando no se configura explicitamente.
Los flags historicos GEMINI_MATCHING_ENABLED y GEMINI_PRICING_ENABLED siguen controlando
el enriquecimiento de sus agentes, ahora a traves de Groq. No fue necesario renombrarlos.

## Comportamiento

- El cliente compartido existente, GeminiClient, conserva su nombre y contratos.
- Groq recibe los prompts y JSON Schemas existentes de Intake, Matching, Pricing y
  los agentes comerciales que utilizan businessAi. Tambien atiende el chat general.
- Se usa JSON Schema estricto mas la validacion de dominio existente de cada agente.
- Se rechazan respuestas truncadas, vacias, refusals, JSON invalido y errores HTTP.
- Timeout cancelable, limites de entrada/salida y una solicitud por invocacion.
- HTTP 429 respeta Retry-After con enfriamiento local; no inicia bucles de reintento.
- DeepSeek/Gemini solo se intentan con AI_LEGACY_FALLBACK_ENABLED=true; habilitarlo
  puede consumir cuotas o saldo de esas cuentas.
- Ante fallos, Matching/Pricing y los demas flujos conservan sus alternativas por reglas.
  Intake no simula una conversacion inteligente: informa el fallo y conserva la sesion.
- No se modifican permisos, ownership, confirmaciones ni publicaciones de Jobs.

El cooldown pertenece al proceso, no es un limitador distribuido. El limite de caracteres
no equivale a tokens ni garantiza estar dentro de la cuota de Groq. El limite diario de
businessAi solo aplica a esos agentes, no a todo el trafico de OfiAI.

## Observabilidad

El colector existente acepta proveedor groq, modelo, latencia, tokens reportados y
motivos seguros de error. No almacena claves ni cuerpos de error del proveedor.
AI_COST_RATES_JSON acepta groq con inputUsdPerMillion y outputUsdPerMillion; no se
precargaron tarifas. Sin tarifa o tokens el costo permanece desconocido, no cero.
La telemetria del transporte no sustituye la validacion semantica de los agentes.

No se agregaron endpoints ni colecciones Firestore. Web y Expo usan sus APIs actuales.

## Archivos

Creado: backend/src/integrations/groq.client.ts y este documento.

Actualizados para esta integracion:

- backend/src/config/env.ts
- backend/src/config/productionReadiness.ts
- backend/src/integrations/gemini/gemini.client.ts
- backend/src/services/ai.service.ts
- backend/src/monitoring/ai-usage.ts
- backend/src/utils/agent-text.ts
- backend/.env.example
- backend/.env (local, ignorado por Git)
- web/src/lib/gemini/index.ts
- README.md
- AIAgents.md
- Deployment.md
- docs/BusinessAgents.md

## Validacion Actualizada: 27/09/2026

- Backend: compilacion TypeScript correcta con Node 24.
- Web: build correcto; persisten advertencias anteriores sobre __dirname en Vite y
  un chunk mayor de 500 kB. No son errores de compilacion.
- Mobile: Expo 54.0.37, TypeScript correcto, 29 tests, Expo Doctor 18/18.
  Bundles Android/iOS exportados; login Android verificado en Expo Go 54, no iPhone.
- git diff --check correcto; avisos de conversion LF/CRLF de Git en Windows.
- Sin coincidencias de nombres de claves IA ni patron de clave Groq en web/src,
  mobile/src y web/dist. backend/.env esta ignorado por Git.
- Backend local reiniciado y /api/v1/health/liveness operacional; scheduler permanece
  deshabilitado en ese proceso de desarrollo para evitar acciones externas.
- Backend: 269 tests; web: 86. Prioridad, opt-in, errores, JSON, cuotas y timeout cubiertos.
- Tres llamadas reales a Groq con datos sinteticos: Intake mantiene contexto y pide
  confirmacion antes de publicar. Tokens observados: 2399 entrada, 597 salida.
- Cache de Matching/Pricing invalida al activar proveedor o cambiar modelo; no guarda claves.
- No hubo despliegue, cobros, envios externos ni escrituras de negocio en produccion.
- Informe completo, resultados de Firestore Emulator y limitaciones: [QA](QA-2026-09-27.md).

## Limites y Pendientes

Falta verificar plan/cuotas y evaluar con datos representativos todos los agentes,
no solo Intake. Una prueba exitosa no demuestra disponibilidad ni calidad general.
qwen/qwen3.8-27b figura como Preview; revisar disponibilidad y conveniencia antes de
produccion. Cambiar GROQ_MODEL requiere un modelo compatible con JSON Schema estricto.
No se incorporo un segundo proveedor gratuito ni fallback a Cloudflare Workers AI.
Esta integracion no cierra los pendientes de produccion detallados en los otros informes.

Referencias oficiales consultadas:

- https://console.groq.com/docs/model/qwen/qwen3.8-27b
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/openai
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/spend-limits
