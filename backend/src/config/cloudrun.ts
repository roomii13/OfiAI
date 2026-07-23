/**
 * @archivo cloudrun.ts
 * @descripcion Módulo de integración y configuración de metadatos para Google Cloud Run en OfiAI Backend.
 * Proporciona detección de entorno, lectura de revisiones y utilidades para interactuar con el servidor de metadatos de GCP.
 * @modulo Config
 */

import http from 'http';
import { env } from './env';
import { logger } from './logger';

/**
 * Interfaz que define la estructura de metadatos de una instancia en Google Cloud Run.
 */
export interface CloudRunMetadata {
  servicio: string;
  revision: string;
  configuracion: string;
  region: string;
  projectId: string;
  puerto: number;
  esCloudRun: boolean;
  instanceId?: string;
  zone?: string;
}

/**
 * Determina si la aplicación se está ejecutando dentro de una instancia administrada de Google Cloud Run.
 * @returns boolean indicando presencia de variables de entorno nativas de Cloud Run.
 */
export const esEntornoCloudRun = (): boolean => {
  return Boolean(process.env.K_SERVICE && process.env.K_REVISION);
};

/**
 * Configuración base estática derivada del entorno para Google Cloud Run.
 */
export const cloudRunConfig: CloudRunMetadata = {
  servicio: process.env.K_SERVICE || 'ofiai-backend-local',
  revision: process.env.K_REVISION || 'local-dev',
  configuracion: process.env.K_CONFIGURATION || 'local',
  region: env.GCP_REGION,
  projectId: env.GCP_PROJECT_ID,
  puerto: env.PORT,
  esCloudRun: esEntornoCloudRun(),
};

/**
 * Consulta un endpoint específico del servidor de metadatos de GCP.
 * @param pathMetadatos - Ruta relativa dentro del servidor de metadatos (ej. 'instance/id').
 * @returns Promesa que resuelve en el valor retornado por el servidor o null si falla.
 */
export const consultarServidorMetadatosGCP = (pathMetadatos: string): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!esEntornoCloudRun()) {
      return resolve(null);
    }

    const options: http.RequestOptions = {
      hostname: 'metadata.google.internal',
      path: `/computeMetadata/v1/${pathMetadatos}`,
      method: 'GET',
      headers: {
        'Metadata-Flavor': 'Google',
      },
      timeout: 1500, // Timeout estricto de 1.5s
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
};

/**
 * Obtiene los metadatos completos y dinámicos de la instancia actual de Cloud Run.
 * @returns Promesa que resuelve en la estructura completa CloudRunMetadata.
 */
export const obtenerMetadatosCloudRun = async (): Promise<CloudRunMetadata> => {
  if (!esEntornoCloudRun()) {
    return cloudRunConfig;
  }

  try {
    const [instanceId, zone] = await Promise.all([
      consultarServidorMetadatosGCP('instance/id'),
      consultarServidorMetadatosGCP('instance/zone'),
    ]);

    return {
      ...cloudRunConfig,
      instanceId: instanceId || undefined,
      zone: zone ? zone.split('/').pop() : undefined,
    };
  } catch (error) {
    logger.warn('⚠️ No se pudieron recuperar los metadatos dinámicos del servidor GCP:', { error });
    return cloudRunConfig;
  }
};
