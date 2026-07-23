# OfiAI - Estándares de Código

## Idioma

- **Comentarios y JSDoc**: Español Latino
- **Nombres de variables/funciones**: camelCase en inglés (convención de JS/TS)
- **Nombres de constantes**: UPPER_SNAKE_CASE
- **Mensajes de error al usuario**: Español Latino
- **Mensajes de log**: Español Latino
- **Commits**: Español Latino (Convencional Commits)

## Nomenclatura

### Backend
- **Archivos**: `kebab-case.ts` (ej: `auth.controller.ts`)
- **Clases**: `PascalCase` (ej: `AuthController`)
- **Funciones/métodos**: `camelCase` (ej: `verificarAutenticacion`)
- **Constantes**: `UPPER_SNAKE_CASE` (ej: `ROLES`)
- **Interfaces**: `PascalCase` con prefijo descriptivo (ej: `RequestAutenticada`)

### Frontend
- **Componentes React**: `PascalCase` (ej: `DashboardLayout`)
- **Hooks**: `camelCase` con prefijo `use` (ej: `useAuth`)
- **Archivos de componentes**: `PascalCase.tsx`
- **Archivos de lógica**: `camelCase.ts`

## Estructura de Archivos

Cada archivo debe comenzar con:
```typescript
/**
 * @archivo nombre-del-archivo.ts
 * @descripcion Descripción clara de la responsabilidad del archivo.
 * @modulo NombreDelModulo
 */
```

## Convenciones de Commits

```
feat: agregar matching IA para empresas
fix: corregir validación de email en registro
docs: actualizar guía de despliegue
refactor: separar lógica de autenticación en servicio
test: agregar tests del agente de pricing
chore: actualizar dependencias de seguridad
```

## TODO: Agregar guía de revisión de código (PR guidelines)
## TODO: Configurar ESLint y Prettier con las reglas del proyecto
