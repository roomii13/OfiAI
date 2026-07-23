/**
 * @archivo health.routes.ts
 * @descripcion
 * Rutas de monitoreo del backend OfiAI.
 */

import { Router } from "express";

const router = Router();


router.get("/", (_req, res) => {

  res.json({
    estado: "operacional",
    servicio: "OfiAI Backend",
    version: process.env.API_VERSION || "v1",
    timestamp: new Date().toISOString(),
  });

});


export const healthRoutes = router;