/** @archivo WhatsAppContact.tsx @descripcion Enlace manual al contacto publico de OfiAI. */
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_CONTACT_URL } from '../lib/contact';

/** Mantiene el acceso a soporte visible sin cubrir formularios ni controles. */
export function WhatsAppContact() {
  return (
    <a
      href={WHATSAPP_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      aria-label="Contactar por WhatsApp (abre otra pestaña)"
      title="Contactar por WhatsApp"
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>Contactar por WhatsApp</span>
    </a>
  );
}
