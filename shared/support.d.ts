/** @archivo support.d.ts @descripcion Conversaciones privadas y escalamiento de soporte. */
export interface SupportMessage { id: string; author: 'user' | 'agent' | 'human'; text: string; at: string; sources: string[]; }
export interface SupportSession {
  id: string; ownerId: string; status: 'open' | 'escalated' | 'resolved';
  resource: { tool: 'getJob' | 'getSubscription' | 'getInvoice' | 'getProfessional'; id?: string } | null;
  messages: SupportMessage[]; version: number; createdAt: string; updatedAt: string;
}
export interface SupportTicket {
  id: string; sessionId: string; ownerId: string; status: 'open' | 'in_progress' | 'resolved';
  priority: 'normal' | 'high'; category: 'billing' | 'security' | 'job' | 'general';
  assignedTo: string | null; createdAt: string; updatedAt: string; version: number;
}
