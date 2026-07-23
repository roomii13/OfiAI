/**
 * @archivo server.ts
 * @descripcion Punto de entrada principal del servidor OfiAI.
 * Inicializa la aplicación Express y comienza a escuchar en el puerto configurado.
 * @modulo Backend
 */

import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const PORT = env.PORT || 8080;

const server = app.listen(PORT, () => {
  logger.info(`🚀 OfiAI Backend corriendo en puerto ${PORT}`);
  logger.info(`📌 Entorno: ${env.NODE_ENV}`);
  logger.info(`🌎 Región LATAM - Español Latino`);
});

// TODO: Configurar graceful shutdown para Google Cloud Run
process.on('SIGTERM', () => {
  logger.info('Señal SIGTERM recibida. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado correctamente.');
    process.exit(0);
  });
});

export default server;
