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
import { errorMiddleware } from './middleware/error.middleware';
import apiRoutes from "./routes";
// TODO: Importar todas las rutas cuando estén implementadas
// import { authRoutes } from './routes/auth.routes';
// import { companyRoutes } from './routes/company.routes';
// import { professionalRoutes } from './routes/professional.routes';
// import { jobsRoutes } from './routes/jobs.routes';
// import { aiRoutes } from './routes/ai.routes';
// import { dashboardRoutes } from './routes/dashboard.routes';
// import { subscriptionRoutes } from './routes/subscriptions.routes';
// import { adminRoutes } from './routes/admin.routes';

const app: Application = express();

// ===== MIDDLEWARES GLOBALES =====
app.use(helmet()); // Seguridad HTTP
app.use(cors({    // TODO: Configurar orígenes permitidos desde env
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Logging de solicitudes HTTP

// ===== RUTA DE SALUD =====
app.use("/api/v1", apiRoutes);

// ===== RUTAS DE LA API v1 =====
// TODO: Registrar rutas cuando estén implementadas
// const API_PREFIX = '/api/v1';
// app.use(`${API_PREFIX}/auth`, authRoutes);
// app.use(`${API_PREFIX}/companies`, companyRoutes);
// app.use(`${API_PREFIX}/professionals`, professionalRoutes);
// app.use(`${API_PREFIX}/jobs`, jobsRoutes);
// app.use(`${API_PREFIX}/ai`, aiRoutes);
// app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
// app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
// app.use(`${API_PREFIX}/admin`, adminRoutes);

// ===== MANEJO GLOBAL DE ERRORES =====
app.use(errorMiddleware);

export default app;
