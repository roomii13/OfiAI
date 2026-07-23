/**
 * @archivo client.ts
 * @descripcion Cliente centralizado de Firestore para OfiAI.
 * Provee acceso tipado a las colecciones de la base de datos.
 * @modulo Database
 */
// TODO: Implementar cliente Firestore cuando Firebase esté configurado
// import { getFirestore } from '../../config/firebase';
// import { COLECCIONES } from './collections';

/**
 * Retorna una referencia tipada a una colección de Firestore.
 * TODO: Implementar con tipado genérico para cada colección
 */
export const obtenerColeccion = (_nombre: string) => {
  // TODO: return getFirestore().collection(nombre);
  throw new Error('Firestore no configurado. Revisa src/config/firebase.ts');
};

/**
 * Helper para convertir timestamps de Firestore a Date de JavaScript.
 * TODO: Implementar conversión de Timestamp
 */
export const convertirTimestamp = (_timestamp: unknown): Date => {
  // TODO: return (timestamp as admin.firestore.Timestamp).toDate();
  return new Date();
};
