/** @archivo knowledge.d.ts @descripcion Memoria consentida y fragmentos citables con alcance explicito. */
export type KnowledgeScope = 'private' | 'organization' | 'job' | 'platform';
export interface KnowledgeDocument {
  id: string; ownerId: string; scope: KnowledgeScope; scopeKey: string; jobId: string | null;
  title: string; text: string; kind: 'preference' | 'policy' | 'history' | 'procedure' | 'documentation';
  published: boolean; version: number; createdAt: string; updatedAt: string; expiresAt: string;
}
export interface KnowledgeHit { documentId: string; version: number; title: string; excerpt: string; score: number; }
export interface KnowledgeSearch { method: 'lexical'; embeddingsEnabled: false; hits: KnowledgeHit[]; scanned: number; partial: boolean; }
