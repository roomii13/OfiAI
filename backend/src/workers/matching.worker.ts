/**
 * @archivo matching.worker.ts
 * @descripcion Worker de matching inteligente para OfiAI.
 * Procesa solicitudes de emparejamiento entre empresas y profesionales usando el motor IA por reglas.
 * @modulo Workers
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Empresa } from '../models/Company';
import { Trabajo } from '../models/Job';
import { matchingService } from '../services/matching.service';
import { notificationService } from '../services/notification.service';

/**
 * Ejecuta matching para un trabajo y notifica a la empresa propietaria.
 */
export const matchingWorker = async (trabajoId: string, notify = true): Promise<void> => {
  const trabajoDoc = await firestore.collection(COLECCIONES.TRABAJOS).doc(trabajoId).get();
  const trabajo = trabajoDoc.exists ? trabajoDoc.data() as Trabajo : null;

  if (!trabajo) {
    return;
  }

  const empresaDoc = await firestore.collection(COLECCIONES.EMPRESAS).doc(trabajo.empresaId).get();
  const empresa = empresaDoc.exists ? empresaDoc.data() as Empresa : null;

  if (!empresa) {
    return;
  }

  const resultado = await matchingService.execute(trabajoId, empresa.usuarioId, 'empresa');
  if (!notify) return;
  await notificationService.crearYEnviar({
    usuarioId: empresa.usuarioId,
    tipo: 'recomendacion_ia',
    canales: ['in_app'],
    datos: {
      tituloTrabajo: trabajo.titulo,
      detalle: `Se generaron ${resultado.matches.length} recomendaciones para tu trabajo.`,
    },
  });
};
