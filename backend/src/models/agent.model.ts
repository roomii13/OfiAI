/** @archivo agent.model.ts @descripcion Identidad verificada y resultados de agentes operativos. */
import type { RolUsuario } from './User';
export interface AgentActor { uid: string; rol: RolUsuario; }
export type AgentName = 'sales' | 'marketing' | 'support' | 'analytics' | 'matching' | 'pricing' | 'coordinator' | 'reputation' | 'intake';
