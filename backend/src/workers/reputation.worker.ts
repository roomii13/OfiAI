/**
 * @archivo reputation.worker.ts
 * @descripcion Worker de cálculo de reputación para profesionales de OfiAI.
 * Actualiza puntaje IA, calificación promedio e historial visible de reseñas.
 * @modulo Workers
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Profesional } from '../models/Professional';
import { Resena } from '../models/Review';
import { reputationAgent } from '../ai/agents/reputation.agent';

/**
 * Recalcula reputación de un profesional desde su perfil y reseñas visibles.
 */
export const reputationWorker = async (profesionalId: string): Promise<void> => {
  const profesionalDoc = await firestore.collection(COLECCIONES.PROFESIONALES).doc(profesionalId).get();
  const profesional = profesionalDoc.exists ? profesionalDoc.data() as Profesional : null;

  if (!profesional) {
    return;
  }

  const reseñasSnapshot = await firestore
    .collection(COLECCIONES.RESENAS)
    .where('destinatarioId', '==', profesionalId)
    .where('visible', '==', true)
    .limit(100)
    .get();
  const reseñas = reseñasSnapshot.docs.map((doc) => doc.data() as Resena);
  const calificacionPromedio = reseñas.length > 0
    ? reseñas.reduce((total, reseña) => total + reseña.calificacion, 0) / reseñas.length
    : profesional.calificacionPromedio;
  const reputacion = reputationAgent.calcularReputacion({
    ...profesional,
    calificacionPromedio,
    totalResenas: reseñas.length,
  });

  await firestore.collection(COLECCIONES.PROFESIONALES).doc(profesionalId).update({
    calificacionPromedio: Math.round((calificacionPromedio + Number.EPSILON) * 100) / 100,
    totalResenas: reseñas.length,
    puntajeReputacionIA: reputacion.puntaje,
    fechaActualizacion: new Date(),
  });
};
