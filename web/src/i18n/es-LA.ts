/**
 * @archivo es-LA.ts
 * @descripcion Diccionario de traducciones en Español Latino para OfiAI.
 * Idioma principal de la plataforma, neutro para toda Latinoamérica.
 * @modulo i18n
 */
export const esLA = {
  // Navegación
  nav: {
    inicio: 'Inicio',
    buscar: 'Buscar',
    publicar: 'Publicar trabajo',
    dashboard: 'Panel de control',
    perfil: 'Mi perfil',
    configuracion: 'Configuración',
    cerrarSesion: 'Cerrar sesión',
    notificaciones: 'Notificaciones',
  },
  // Autenticación
  auth: {
    iniciarSesion: 'Iniciar sesión',
    registrarse: 'Registrarse',
    cerrarSesion: 'Cerrar sesión',
    email: 'Correo electrónico',
    contrasena: 'Contraseña',
    olvidarContrasena: '¿Olvidaste tu contraseña?',
    recuperarContrasena: 'Recuperar contraseña',
    yaEstabaRegistrado: '¿Ya tienes cuenta? Inicia sesión',
    noTieneCuenta: '¿No tienes cuenta? Regístrate',
    rol: {
      empresa: 'Soy una empresa',
      profesional: 'Soy un profesional',
    },
  },
  // Roles
  roles: {
    empresa: 'Empresa',
    profesional: 'Profesional',
    admin: 'Administrador',
  },
  // Dashboard
  dashboard: {
    bienvenido: 'Bienvenido',
    resumen: 'Resumen',
    trabajosActivos: 'Trabajos activos',
    propuestas: 'Propuestas',
    calificacion: 'Calificación',
    ingresos: 'Ingresos del mes',
    IA: 'Asistente IA',
  },
  // Trabajos
  trabajos: {
    publicar: 'Publicar trabajo',
    buscar: 'Buscar trabajo',
    categorias: 'Categorías',
    presupuesto: 'Presupuesto',
    ubicacion: 'Ubicación',
    estado: {
      publicado: 'Publicado',
      enProgreso: 'En progreso',
      completado: 'Completado',
      cancelado: 'Cancelado',
    },
  },
  // General
  general: {
    guardar: 'Guardar',
    cancelar: 'Cancelar',
    eliminar: 'Eliminar',
    editar: 'Editar',
    ver: 'Ver',
    cargar: 'Cargando...',
    error: 'Ocurrió un error',
    exitoso: '¡Operación exitosa!',
    sinResultados: 'No hay resultados',
    siguiente: 'Siguiente',
    anterior: 'Anterior',
    confirmar: 'Confirmar',
  },
  // Planes SaaS
  suscripcion: {
    titulo: 'Elige tu plan',
    basico: 'Básico',
    pro: 'Pro',
    enterprise: 'Enterprise',
    porMes: '/mes',
    elegir: 'Elegir plan',
    actual: 'Plan actual',
  },
  // IA
  ia: {
    procesando: 'Procesando con IA...',
    recomendaciones: 'Recomendaciones de IA',
    matching: 'Análisis de compatibilidad',
    precio: 'Estimación de precio',
    asistente: 'Asistente OfiAI',
  },
} as const;

export type ClaveTraducciones = typeof esLA;
