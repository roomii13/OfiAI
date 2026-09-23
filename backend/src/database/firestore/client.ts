import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo client.ts
 * @descripcion Cliente centralizado de Firestore para OfiAI.
 * Provee acceso tipado a colecciones y helpers de conversión de fechas.
 * @modulo Database
 */
import { getFirestore } from '../../config/firebase';

/**
 * Retorna una referencia tipada a una colección de Firestore.
 */
export const obtenerColeccion = <T = FirebaseFirestore.DocumentData>(
  nombre: string
): FirebaseFirestore.CollectionReference<T> => {
  return getFirestore().collection(nombre) as FirebaseFirestore.CollectionReference<T>;
};

/**
 * Convierte Date, Timestamp de Firestore o valores serializados a Date.
 */
export const convertirTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }

  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
  ) {
    return (timestamp as { toDate: () => Date }).toDate();
  }

  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const fecha = new Date(timestamp);
    return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  }

  return new Date();
};
