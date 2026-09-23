/**
 * @archivo app.ts
 * @descripcion Configuración principal de la aplicación Express para OfiAI.
 * Registra middlewares globales, rutas de la API y manejo de errores.
 * @modulo Backend
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import apiRoutes from "./routes";

const app: Application = express();

/**
 * Valida orígenes CORS contra la configuración del ambiente.
 */
function resolverOrigenCors(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
  if (!origin || env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origen CORS no permitido por OfiAI.'));
}

// ===== MIDDLEWARES GLOBALES =====
app.use(helmet()); // Seguridad HTTP
app.use(cors({
  origin: resolverOrigenCors,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Logging de solicitudes HTTP

// ===== RUTA DE SALUD =====
app.use("/api/v1", apiRoutes);

// ===== MANEJO GLOBAL DE ERRORES =====
app.use(errorMiddleware);

export default app;
