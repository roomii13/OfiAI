/** @archivo firebasePersistence.ts @descripcion Adaptador de Firebase Auth a SecureStore con fragmentos menores al limite nativo. */
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

const CHUNK_LENGTH = 400;
const PREFIX = 'ofiai.firebase.auth';

interface StorageManifest {
  generation: string;
  chunks: number;
}

/** Valida el manifiesto antes de construir claves de almacenamiento. */
function isStorageManifest(value: unknown): value is StorageManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<StorageManifest>;
  return typeof manifest.generation === 'string'
    && typeof manifest.chunks === 'number'
    && Number.isInteger(manifest.chunks)
    && manifest.chunks >= 0
    && manifest.chunks <= 1000;
}

/** Genera una clave local compacta y estable para el identificador interno de Firebase. */
function storageId(key: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const character of key) {
    const code = character.codePointAt(0) ?? 0;
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16)}${second.toString(16)}`;
}

/** Devuelve las claves SecureStore de una generacion ya publicada. */
function chunkKeys(id: string, manifest: StorageManifest): string[] {
  return Array.from({ length: manifest.chunks }, (_, index) => `${PREFIX}.${id}.${manifest.generation}.${index}`);
}

/** Convierte SecureStore en la interfaz asincrona que espera Firebase Auth en React Native. */
export const firebaseAuthStorage = {
  /** Persiste una cadena larga en fragmentos seguros y publica el manifiesto al final. */
  async setItem(key: string, value: string): Promise<void> {
    const id = storageId(key);
    const generation = randomUUID();
    const characters = Array.from(value);
    const pieces = Array.from({ length: Math.ceil(characters.length / CHUNK_LENGTH) }, (_, index) =>
      characters.slice(index * CHUNK_LENGTH, (index + 1) * CHUNK_LENGTH).join(''));
    const manifestKey = `${PREFIX}.${id}.current`;
    const previousRaw = await SecureStore.getItemAsync(manifestKey);
    const previous = previousRaw ? JSON.parse(previousRaw) as StorageManifest : null;
    const newManifest: StorageManifest = { generation, chunks: pieces.length };

    await Promise.all(pieces.map((piece, index) =>
      SecureStore.setItemAsync(`${PREFIX}.${id}.${generation}.${index}`, piece)));
    await SecureStore.setItemAsync(manifestKey, JSON.stringify(newManifest));

    if (previous) {
      await Promise.all(chunkKeys(id, previous).map(chunk => SecureStore.deleteItemAsync(chunk).catch(() => undefined)));
    }
  },

  /** Reconstruye solo generaciones completas; nunca devuelve una sesion parcial. */
  async getItem(key: string): Promise<string | null> {
    const id = storageId(key);
    const raw = await SecureStore.getItemAsync(`${PREFIX}.${id}.current`);
    if (!raw) return null;

    let manifest: StorageManifest;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStorageManifest(parsed)) return null;
      manifest = parsed;
    } catch { return null; }

    const pieces = await Promise.all(chunkKeys(id, manifest).map(chunk => SecureStore.getItemAsync(chunk)));
    return pieces.every((piece): piece is string => piece !== null) ? pieces.join('') : null;
  },

  /** Borra primero el puntero activo y luego los fragmentos asociados. */
  async removeItem(key: string): Promise<void> {
    const id = storageId(key);
    const manifestKey = `${PREFIX}.${id}.current`;
    const raw = await SecureStore.getItemAsync(manifestKey);
    if (!raw) return;

    let manifest: StorageManifest;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStorageManifest(parsed)) {
        await SecureStore.deleteItemAsync(manifestKey);
        return;
      }
      manifest = parsed;
    } catch {
      await SecureStore.deleteItemAsync(manifestKey);
      return;
    }

    await SecureStore.deleteItemAsync(manifestKey);
    await Promise.all(chunkKeys(id, manifest).map(chunk => SecureStore.deleteItemAsync(chunk)));
  },
};
