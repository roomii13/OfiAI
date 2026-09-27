/** @archivo knowledge.tool.ts @descripcion Recuperacion lexical transparente e interfaz de embeddings futura. */
import type { KnowledgeDocument, KnowledgeHit } from '../../../../shared/knowledge';
/** Un proveedor futuro debe identificarse y producir vectores; no se simulan embeddings. */
export interface EmbeddingProvider {
  readonly model: string; readonly dimensions: number;
  embed(texts: readonly string[],signal: AbortSignal): Promise<readonly number[][]>;
}
/** Normaliza terminos de busqueda sin interpretarlos como instrucciones. */
function terms(text: string): string[] {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)?.slice(0,1000) ?? [];
}
/** Recupera fragmentos con palabras compartidas; declara que no es busqueda vectorial. */
export function retrieveKnowledge(query: string,documents: KnowledgeDocument[]): KnowledgeHit[] {
  const wanted = new Set(terms(query)); const hits: KnowledgeHit[] = [];
  for (const doc of documents) {
    const paragraphs = doc.text.match(/[\s\S]{1,1200}(?:\s|$)/g) ?? [doc.text.slice(0,1200)];
    let best = { excerpt: '',score: 0 };
    for (const excerpt of paragraphs.slice(0,10)) {
      const found = new Set(terms(excerpt)); const title = new Set(terms(doc.title));
      const score = [...wanted].reduce((sum,term)=>sum+(found.has(term) ? 1 : 0)+(title.has(term) ? 2 : 0),0);
      if (score > best.score) best = { excerpt,score };
    }
    if (best.score > 0) hits.push({documentId: doc.id,version: doc.version,title: doc.title,...best});
  }
  return hits.sort((a,b)=>b.score-a.score || a.documentId.localeCompare(b.documentId)).slice(0,5);
}
