# Prompt Engineering

OfiAI usa prompts estructurados en backend para evitar exponer claves de Gemini en web o mobile. La primera versión funciona con reglas propias y puede mejorar respuestas con Gemini cuando `GEMINI_API_KEY` esté configurada.

## Principios

- Mantener datos sensibles fuera del navegador.
- Separar prompts por intención: ranking, soporte, pricing, intake y analytics.
- Incluir contexto mínimo necesario.
- Pedir salidas estructuradas cuando alimenten workflows.
- Registrar motor usado: `reglas` o `gemini`.
- Mantener fallback determinístico ante error o falta de API key.

## Prompt de Ranking

La implementacion vigente de Fase 5 usa matching.prompt.ts, MATCHING_PROMPT_VERSION=1.0.0 y salida JSON validada con Zod.
Solo recibe candidatos prefiltrados, nunca contactos, UID, coordenadas exactas ni secretos.
Exige un resultado por ID recibido con semanticScore 0..100, reason, strengths, concerns y recommended.
El score final conserva 80% de reglas propias; ante timeout, limite, JSON invalido o proveedor no disponible conserva el score determinista completo.
Los prompts anteriores siguen existiendo para rutas heredadas. Detalle vigente: [Matching Agent](docs/MatchingAgent.md).

Entrada mínima:

- Trabajo: categoría, subcategoría, habilidades, ciudad, tipo, presupuesto.
- Candidatos: especialidades, ciudad, disponibilidad, calificación, verificación.
- Resultado por reglas: puntaje, razones y alertas.

Salida esperada:

- Observaciones sobre top candidatos.
- Riesgos de contratación.
- Preguntas de validación para la empresa.
- Señales que conviene medir para mejorar el ranking.

## Prompt de Chat Soporte

Entrada mínima:

- Rol del usuario.
- Mensaje.
- Contexto operativo.

Salida esperada:

- Respuesta breve.
- Acciones sugeridas.
- Advertencias si falta información.

## Prompt de Intake

Entrada mínima:

- Título y descripción.
- Ciudad.
- Urgencia percibida.

Salida esperada:

- Categoría.
- Subcategoría.
- Habilidades detectadas.
- Prioridad.
- Complejidad.
- Necesidad de visita técnica.

## Evaluación

Métricas recomendadas:

- Precisión de categoría.
- Tasa de aceptación del top 3 de matching.
- Tiempo hasta primera contratación.
- Correcciones manuales por empresa.
- Reintentos o reformulaciones en chat.

## Seguridad

- No enviar secretos ni tokens al prompt.
- No incluir datos personales innecesarios.
- No pedir decisiones finales sin revisión humana en trabajos sensibles.
- Guardar trazas resumidas, no conversaciones completas con información sensible.
