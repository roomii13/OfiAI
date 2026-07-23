/**
 * @archivo company-created.event.ts
 * @descripcion Evento disparado cuando una empresa se registra en OfiAI.
 * @modulo Events
 */
export interface EventoEmpresaCreada {
  empresaId: string;
  usuarioId: string;
  pais: string;
  timestamp: Date;
}

export const publicarEventoEmpresaCreada = async (_evento: EventoEmpresaCreada): Promise<void> => {
  // TODO: Enviar email de bienvenida via Resend
  // TODO: Iniciar flujo de onboarding guiado por el sales.agent.ts
  // TODO: Activar período de prueba gratuito
  // TODO: Registrar en analytics de nuevos usuarios
};
