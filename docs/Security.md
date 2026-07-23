# OfiAI - Guía de Seguridad

## Principios de Seguridad

1. **Defensa en profundidad**: Múltiples capas de seguridad
2. **Principio de mínimo privilegio**: Cada rol accede solo a lo que necesita
3. **Zero Trust**: Verificar siempre, nunca asumir confianza

## Autenticación

- Firebase Authentication maneja tokens JWT
- Tokens se verifican en el backend con Firebase Admin SDK
- Sesiones persisten de forma segura
- Tokens de Firebase expiran en 1 hora (refresh automático)

## Autorización (RBAC)

- Roles definidos en `src/constants/roles.ts`
- Permisos granulares en `src/constants/permissions.ts`
- Middleware `requerirRol()` protege rutas por rol
- Reglas de Firestore como segunda línea de defensa

## Variables de Entorno

- NUNCA commitear `.env` al repositorio
- Usar `.env.example` como plantilla
- En producción: usar Google Cloud Secret Manager
- Rotar claves API regularmente

## Rate Limiting

- Límite general: 100 req/15min por IP
- Límite auth: 10 req/hora por IP (prevenir brute force)
- Límite IA: 20 req/min por usuario (controlar costos Gemini)

## TODO: Agregar checklist de seguridad para revisión de código
## TODO: Agregar política de manejo de datos personales (GDPR/LGPD)
## TODO: Agregar proceso de reporte de vulnerabilidades
