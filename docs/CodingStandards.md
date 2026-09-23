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

## Revisión de Código

- Cada cambio debe compilar en su paquete.
- No se aceptan stubs vacíos ni pseudocódigo.
- Los cambios de negocio deben incluir prueba o justificación explícita.
- No se modifican carpetas, nombres ni contratos públicos sin motivo documentado.

## Formato

El proyecto usa TypeScript estricto. ESLint queda disponible por paquete y las reglas deben mantenerse alineadas con los scripts locales.
