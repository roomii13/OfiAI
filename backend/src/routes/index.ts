/**
 * @archivo index.ts
 * @descripcion
 * Registro central de rutas API.
 */

import { Router } from "express";
import { healthRoutes } from "./health.routes";
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

router.use("/auth", authRoutes);
router.use("/ai", aiRoutes);
router.use("/admin", adminRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/companies", companyRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/health", healthRoutes);
router.use("/jobs", jobsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/professionals", professionalRoutes);
router.use("/scheduler", schedulerRoutes);
router.use("/subscriptions", subscriptionRoutes);


export default router;
