/** @archivo firebasePersistence.test.ts @descripcion Comprueba almacenamiento Firebase seguro, fragmentado y recuperable. */
import { firebaseAuthStorage } from './firebasePersistence';

const mockSecureStore = new Map<string, string>();
let mockGeneration = 0;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecureStore.delete(key); }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => `generation-${++mockGeneration}` }));

beforeEach(() => { mockSecureStore.clear(); mockGeneration = 0; });

it('recupera datos grandes con Unicode en piezas menores al limite de SecureStore', async () => {
  const value = 'sesion🔐á'.repeat(2400);
  await firebaseAuthStorage.setItem('firebase:authUser:project:app', value);
  await expect(firebaseAuthStorage.getItem('firebase:authUser:project:app')).resolves.toBe(value);
  expect([...mockSecureStore.entries()].filter(([key]) => !key.endsWith('.current'))
    .every(([, piece]) => Array.from(piece).length <= 400)).toBe(true);
});

it('publica el estado nuevo antes de limpiar la generacion anterior', async () => {
  await firebaseAuthStorage.setItem('firebase:authUser:project:app', 'sesion-anterior');
  const previous = [...mockSecureStore.keys()].filter(key => key.includes('generation-1'));
  await firebaseAuthStorage.setItem('firebase:authUser:project:app', 'sesion-renovada');
  expect(await firebaseAuthStorage.getItem('firebase:authUser:project:app')).toBe('sesion-renovada');
  expect(previous.every(key => !mockSecureStore.has(key))).toBe(true);
});

it('no reconstruye sesiones parciales y limpia los fragmentos al cerrar', async () => {
  await firebaseAuthStorage.setItem('firebase:authUser:project:app', 'sesion-persistida');
  const chunk = [...mockSecureStore.keys()].find(key => key.endsWith('.0'))!;
  mockSecureStore.delete(chunk);
  expect(await firebaseAuthStorage.getItem('firebase:authUser:project:app')).toBeNull();
  await firebaseAuthStorage.removeItem('firebase:authUser:project:app');
  expect(mockSecureStore.size).toBe(0);
});
