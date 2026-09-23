/**
 * @archivo intake-fixtures.ts
 * @descripcion Fixtures y Firestore transaccional en memoria, solo para pruebas sin credenciales.
 */
import { randomUUID } from 'node:crypto';
import { emptyIntakeData } from '../src/ai/tools/intake-state.tool';
import type { IntakeData } from '../src/models/intake.model';

/** Solicitud completa de prueba; no es una respuesta real de Gemini. */
export function completeIntakeData(): IntakeData {
  return {
    ...emptyIntakeData(), category: 'Impermeabilizacion', title: 'Reparar humedad en fachada',
    description: 'Reparar humedad en la fachada de un edificio de 5 pisos y 18 departamentos.',
    location: { country: 'Argentina', city: 'Santa Rosa', region: 'La Pampa' },
    urgency: 'high', preferredDate: 'La proxima semana', estimatedScope: '5 pisos, 18 departamentos',
    budgetStatus: 'to_quote', requirements: ['Trabajo en altura'], attachmentsRequired: true,
    attachmentReason: 'Fotos de la fachada ayudan a evaluar el trabajo.', multipleProfessionals: true,
    professionalTypes: ['Impermeabilizacion', 'Trabajo en altura'], workType: 'presencial',
  };
}

type Data = Record<string, unknown>;
interface MemorySnapshot { id: string; exists: boolean; ref: MemoryReference; data: () => Data | undefined }
interface MemoryReference {
  id: string; key: string; get: () => Promise<MemorySnapshot>; set: (data: Data) => Promise<void>;
  update: (data: Data) => Promise<void>; collection: (name: string) => MemoryQuery;
}
interface MemoryQuery {
  doc: (id?: string) => MemoryReference; where: (field: string, operator: string, value: unknown) => MemoryQuery;
  limit: (value: number) => MemoryQuery; orderBy: (...args: unknown[]) => MemoryQuery;
  select: (...fields: string[]) => MemoryQuery; startAfter: (doc: { id: string }) => MemoryQuery;
  get: () => Promise<{ docs: MemorySnapshot[]; empty: boolean; size: number }>;
}
interface MemoryTransaction {
  get: <T>(ref: { get: () => Promise<T> }) => Promise<T>;
  create: (ref: { key: string }, data: Data) => void; update: (ref: { key: string }, data: Data) => void;
  set: (ref: { key: string }, data: Data) => void; delete: (ref: { key: string }) => void;
}
/** Adaptador transaccional para probar repositorios; no sustituye el emulador de reglas. */
export class MemoryFirestore {
  readonly documents = new Map<string, Data>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Limpia unicamente datos sinteticos entre pruebas. */
  clear(): void { this.documents.clear(); }
  /** Selecciona solo campos publicos solicitados por el repositorio. */
  private snapshot(ref: MemoryReference, fields?: string[]): MemorySnapshot {
    const value = this.documents.get(ref.key);
    const data = value && (fields ? Object.fromEntries(fields.filter(field => field in value).map(field => [field, value[field]])) : value);
    return { exists: value !== undefined, id: ref.id, ref, data: () => data ? structuredClone(data) : undefined };
  }
  /** Implementa proyeccion y paginacion por ID sin mezclar subcolecciones. */
  collection(name: string): MemoryQuery {
    const db = this;
    const filters: Array<[string, unknown]> = [];
    let limit = Infinity; let after = ''; let fields: string[] | undefined; let ordered = false;
    const query: MemoryQuery = {
      /** Crea una referencia estable y permite subcolecciones. */
      doc(id = randomUUID()) {
        const key = name + '/' + id;
        const ref: MemoryReference = {
          id, key,
          /** Lee el documento con su referencia. */
          async get() { return db.snapshot(ref); },
          /** Guarda un fixture. */
          async set(data) { db.documents.set(key, structuredClone(data)); },
          /** Actualiza un fixture. */
          async update(data) { db.documents.set(key, { ...db.documents.get(key), ...structuredClone(data) }); },
          /** Accede a una subcoleccion real en el mapa de pruebas. */
          collection(child) { return db.collection(key + '/' + child); },
        };
        return ref;
      },
      /** Agrega igualdad como filtro. */
      where(field, operator, value) {
        if (operator !== '==') throw new Error('Operador no soportado en fixture');
        filters.push([field, value]); return query;
      },
      /** Limita lecturas. */
      limit(value) { limit = value; return query; },
      /** Ordena deterministicamente por ID para la paginacion de matching. */
      orderBy() { ordered = true; return query; },
      /** Aplica la proyeccion de campos permitidos. */
      select(...values) { fields = values; return query; },
      /** Reanuda despues del cursor. */
      startAfter(doc) { after = doc.id; return query; },
      /** Consulta solamente documentos hijos directos. */
      async get() {
        let rows = [...db.documents.entries()].filter(([key, value]) =>
          key.slice(0, key.lastIndexOf('/')) === name && key.slice(key.lastIndexOf('/') + 1) > after &&
          filters.every(([field, expected]) => value[field] === expected));
        if (ordered) rows = rows.sort(([a], [b]) => a.localeCompare(b));
        const docs = rows.slice(0, limit).map(([key]) => db.snapshot(query.doc(key.slice(key.lastIndexOf('/') + 1)), fields));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
    return query;
  }
  /** Lee por IDs manteniendo la mascara de campos de Firestore. */
  async getAll(...items: Array<MemoryReference | { fieldMask: string[] }>): Promise<MemorySnapshot[]> {
    const options = items.find((item): item is { fieldMask: string[] } => 'fieldMask' in item);
    return items.filter((item): item is MemoryReference => 'key' in item).map(ref => this.snapshot(ref, options?.fieldMask));
  }
  /** Serializa, revierte en error y rechaza lecturas despues de escrituras. */
  async runTransaction<T>(work: (tx: MemoryTransaction) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const staged = new Map(this.documents); let wrote = false;
      const tx: MemoryTransaction = {
        /** Lee solo antes de escribir, igual que Firestore. */
        get: async ref => { if (wrote) throw new Error('Lectura posterior a escritura'); return ref.get(); },
        /** Verifica que no exista un documento. */
        create: (ref, data) => {
          if (staged.has(ref.key)) throw new Error('Ya existe');
          wrote = true; staged.set(ref.key, structuredClone(data));
        },
        /** Actualiza un documento existente. */
        update: (ref, data) => {
          if (!staged.has(ref.key)) throw new Error('No existe');
          wrote = true; staged.set(ref.key, { ...staged.get(ref.key), ...structuredClone(data) });
        },
        /** Guarda una version atomica. */
        set: (ref, data) => { wrote = true; staged.set(ref.key, structuredClone(data)); },
        /** Elimina solo dentro de la transaccion. */
        delete: ref => { wrote = true; staged.delete(ref.key); },
      };
      const value = await work(tx); this.documents.clear();
      for (const [key, data] of staged) this.documents.set(key, data);
      return value;
    });
    this.queue = result.catch(() => undefined); return result;
  }
}
