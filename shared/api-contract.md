# OfiAI - Contrato de API

Documento que define los endpoints, formatos de request/response y códigos de error de la API.

## Base URL

- **Desarrollo**: `http://localhost:8080/api/v1`
- **Producción**: `https://api.ofiai.com/api/v1`

## Autenticación

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer {firebase-id-token}
```

## Endpoints

### Auth
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/auth/registro` | Registrar usuario | No |
| POST | `/auth/login` | Verificar y obtener perfil | No |
| POST | `/auth/recuperar-password` | Enviar email de recuperación | No |
| GET | `/auth/perfil` | Obtener perfil del usuario | Sí |

### Empresas
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | `/companies` | Crear perfil de empresa | empresa |
| GET | `/companies/:id` | Obtener empresa | auth |
| PUT | `/companies/:id` | Actualizar empresa | empresa |
| GET | `/companies` | Listar empresas | admin |

### Profesionales
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | `/professionals` | Crear perfil profesional | profesional |
| GET | `/professionals/:id` | Obtener profesional | auth |
| PUT | `/professionals/:id` | Actualizar profesional | profesional |
| GET | `/professionals/buscar` | Buscar con filtros | empresa |

### Trabajos
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | `/jobs` | Publicar trabajo | empresa |
| GET | `/jobs/:id` | Obtener trabajo | auth |
| PUT | `/jobs/:id` | Actualizar trabajo | empresa |
| DELETE | `/jobs/:id` | Eliminar trabajo | empresa |
| GET | `/jobs` | Listar trabajos con filtros | auth |

### IA
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | `/ai/matching` | Ejecutar matching IA | empresa |
| POST | `/ai/pricing` | Estimar precio IA | empresa |
| GET | `/ai/recomendaciones` | Trabajos recomendados | profesional |

### Dashboard
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| GET | `/dashboard/empresa` | Dashboard de empresa | empresa |
| GET | `/dashboard/profesional` | Dashboard de profesional | profesional |
| GET | `/dashboard/admin` | Dashboard de administrador | admin |

## Formato de Respuesta

```json
{
  "exito": true,
  "datos": {},
  "mensaje": "Operación exitosa"
}
```

## Códigos de Error

| Código | Descripción |
|---|---|
| 400 | Datos inválidos |
| 401 | No autenticado |
| 403 | Sin permisos (rol incorrecto) |
| 404 | Recurso no encontrado |
| 429 | Demasiadas solicitudes |
| 500 | Error interno del servidor |
