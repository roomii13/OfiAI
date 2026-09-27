/**
 * @archivo firebase-config.test.ts
 * @descripcion Comprueba la seleccion explicita de bases Firestore con nombre.
 */
import { getFirestore as firestoreSdk } from 'firebase-admin/firestore';
import { getFirestore, getFirebaseApp } from '../../src/config/firebase';

jest.mock('../../src/config/env', () => ({
  env: { FIREBASE_PROJECT_ID: 'demo-ofiai', FIREBASE_DATABASE_ID: 'default' },
}));
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'test-app' })),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ settings: jest.fn() })),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

it('selecciona default sin parentesis y conserva la inicializacion unica', () => {
  const first = getFirestore();
  getFirestore();
  expect(firestoreSdk).toHaveBeenCalledWith(getFirebaseApp(), 'default');
  expect(first.settings).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
  expect(first.settings).toHaveBeenCalledTimes(1);
});
