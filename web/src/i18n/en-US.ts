/**
 * @archivo en-US.ts
 * @descripcion English (US) translations dictionary for OfiAI.
 * Secondary language for international users and admin panel.
 * @modulo i18n
 */
export const enUS = {
  nav: {
    inicio: 'Home', buscar: 'Search', publicar: 'Post a job', dashboard: 'Dashboard',
    perfil: 'My profile', configuracion: 'Settings', cerrarSesion: 'Sign out', notificaciones: 'Notifications',
  },
  auth: {
    iniciarSesion: 'Sign in', registrarse: 'Sign up', cerrarSesion: 'Sign out',
    email: 'Email address', contrasena: 'Password', olvidarContrasena: 'Forgot password?',
    recuperarContrasena: 'Reset password', yaEstabaRegistrado: 'Already have an account? Sign in',
    noTieneCuenta: "Don't have an account? Sign up",
    rol: { empresa: 'I am a company', profesional: 'I am a professional' },
  },
  roles: { empresa: 'Company', profesional: 'Professional', admin: 'Administrator' },
  dashboard: {
    bienvenido: 'Welcome', resumen: 'Summary', trabajosActivos: 'Active jobs',
    propuestas: 'Proposals', calificacion: 'Rating', ingresos: 'Monthly income', IA: 'AI Assistant',
  },
  trabajos: {
    publicar: 'Post a job', buscar: 'Find jobs', categorias: 'Categories', presupuesto: 'Budget',
    ubicacion: 'Location',
    estado: { publicado: 'Published', enProgreso: 'In progress', completado: 'Completed', cancelado: 'Cancelled' },
  },
  general: {
    guardar: 'Save', cancelar: 'Cancel', eliminar: 'Delete', editar: 'Edit', ver: 'View',
    cargar: 'Loading...', error: 'An error occurred', exitoso: 'Success!',
    sinResultados: 'No results', siguiente: 'Next', anterior: 'Previous', confirmar: 'Confirm',
  },
  suscripcion: {
    titulo: 'Choose your plan', basico: 'Basic', pro: 'Pro', enterprise: 'Enterprise',
    porMes: '/month', elegir: 'Choose plan', actual: 'Current plan',
  },
  ia: {
    procesando: 'Processing with AI...', recomendaciones: 'AI Recommendations',
    matching: 'Compatibility analysis', precio: 'Price estimation', asistente: 'OfiAI Assistant',
  },
} as const;
