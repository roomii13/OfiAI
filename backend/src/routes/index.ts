/**
 * @archivo index.ts
 * @descripcion
 * Registro central de rutas API.
 */

import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/health", healthRoutes);


export default router;