/**
 * @archivo index.ts
 * @descripcion Integración con Firebase Storage para archivos de OfiAI.
 * Valida, sube, firma y elimina avatares, portafolios y documentos de usuarios.
 * @modulo Integrations
 */

import { firebaseStorage } from '../firebase/admin';

export type TipoArchivoStorage = 'imagen' | 'documento';

export interface ArchivoStorage {
  buffer: Buffer;
  nombre: string;
  contentType: string;
  size: number;
}

export interface ResultadoSubidaStorage {
  bucket: string;
  path: string;
  contentType: string;
  size: number;
}

const MIME_IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_DOCUMENTOS = ['application/pdf'];
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

/**
 * Sube un archivo validado a Firebase Storage.
 */
export const subirArchivoStorage = async (
  archivo: ArchivoStorage,
  destinoPath: string,
  tipo: TipoArchivoStorage
): Promise<ResultadoSubidaStorage> => {
  validarArchivoStorage(archivo, tipo);

  const bucket = firebaseStorage.bucket();
  const file = bucket.file(destinoPath);

  await file.save(archivo.buffer, {
    resumable: false,
    contentType: archivo.contentType,
    metadata: {
      contentType: archivo.contentType,
      metadata: {
        originalName: archivo.nombre,
      },
    },
  });

  return {
    bucket: bucket.name,
    path: destinoPath,
    contentType: archivo.contentType,
    size: archivo.size,
  };
};

/**
 * Genera una URL firmada de lectura para un archivo privado.
 */
export const generarUrlFirmadaStorage = async (path: string, minutosValidez = 30): Promise<string> => {
  const bucket = firebaseStorage.bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + minutosValidez * 60 * 1000,
  });

  return url;
};

/**
 * Elimina un archivo de Firebase Storage ignorando faltantes.
 */
export const eliminarArchivoStorage = async (path: string): Promise<void> => {
  const bucket = firebaseStorage.bucket();
  await bucket.file(path).delete({ ignoreNotFound: true });
};

/**
 * Valida tipo MIME y tamaño máximo antes de subir.
 */
export const validarArchivoStorage = (archivo: ArchivoStorage, tipo: TipoArchivoStorage): void => {
  const mimesPermitidos = tipo === 'imagen' ? MIME_IMAGENES : MIME_DOCUMENTOS;
  const maximo = tipo === 'imagen' ? MAX_IMAGEN_BYTES : MAX_DOCUMENTO_BYTES;

  if (!mimesPermitidos.includes(archivo.contentType)) {
    throw new Error(`Tipo de archivo no permitido para ${tipo}: ${archivo.contentType}`);
  }

  if (archivo.size > maximo) {
    throw new Error(`El archivo excede el tamaño máximo permitido para ${tipo}.`);
  }
};
