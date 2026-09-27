/** @archivo agent.event.ts @descripcion Outbox atomico de eventos operativos sin prompts ni datos personales. */
import { randomUUID } from 'node:crypto';
export interface AgentBusinessEvent {
  id:string;ownerId:string;resourceId:string;event:'job.created';requestId:string;
  state:'pending'|'processing'|'completed'|'failed';attempts:number;availableAt:string;createdAt:string;updatedAt:string;
}
/** El mismo Job produce un unico evento durable al publicarse. */
export function jobAgentEvent(jobId:string,ownerId:string):AgentBusinessEvent {
  const now=new Date().toISOString();
  return {id:'job_'+jobId,ownerId,resourceId:jobId,event:'job.created',requestId:randomUUID(),
    state:'pending',attempts:0,availableAt:now,createdAt:now,updatedAt:now};
}
