/**
 * @archivo index.ts
 * @descripcion
 * Registro central de rutas API.
 */

import { Router } from "express";
import { salesRoutes } from './sales.routes';
import { marketingRoutes } from './marketing.routes';
import { supportRoutes } from './support.routes';
import { intelligenceRoutes } from './intelligence.routes';
import { orchestratorRoutes } from './orchestrator.routes';
import { knowledgeRoutes } from './knowledge.routes';
import { governanceRoutes } from './governance.routes';
import { healthRoutes } from "./health.routes";
import { coordinatorListRoutes } from './coordinator.routes';
import { authRoutes } from "./auth.routes";
import { aiRoutes } from "./ai.routes";
import { adminRoutes } from "./admin.routes";
import { analyticsRoutes } from "./analytics.routes";
import { companyRoutes } from "./company.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { jobsRoutes } from "./jobs.routes";
import { notificationRoutes } from "./notification.routes";
import { professionalRoutes } from "./professional.routes";
import { schedulerRoutes } from "./scheduler.routes";
import { subscriptionRoutes } from "./subscriptions.routes";

const router = Router();
router.use('/sales', salesRoutes);
router.use('/marketing', marketingRoutes);
router.use('/support', supportRoutes);
router.use('/intelligence', intelligenceRoutes);
router.use('/agents', orchestratorRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/governance', governanceRoutes);

router.use("/auth", authRoutes);
router.use("/ai", aiRoutes);
router.use("/admin", adminRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/companies", companyRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/health", healthRoutes);
router.use("/jobs", jobsRoutes);
router.use('/coordinator', coordinatorListRoutes);
router.use("/notifications", notificationRoutes);
router.use("/professionals", professionalRoutes);
router.use("/scheduler", schedulerRoutes);
router.use("/subscriptions", subscriptionRoutes);


export default router;
