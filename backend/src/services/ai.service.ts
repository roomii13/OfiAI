/**
 * @archivo ai.service.ts
 * @descripcion Servicio de aplicación para las capacidades de Inteligencia Artificial de OfiAI.
 * Coordina agentes, herramientas de reglas, Firestore y Gemini opcional para matching, clasificación, pricing y chat.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Empresa } from '../models/Company';
import { Trabajo } from '../models/Job';
import { Profesional } from '../models/Professional';
import { RolUsuario } from '../models/User';
import { matchingAgent } from '../ai/agents/matching.agent';
import { intakeAgent } from '../ai/agents/intake.agent';
import { pricingAgent, EntradaEstimacionPrecio, ResultadoEstimacionPrecio } from '../ai/agents/pricing.agent';
import { supportAgent } from '../ai/agents/support.agent';
import { ResultadoRankingProfesional } from '../ai/tools/ranking.tool';
import { ResultadoClasificacionSolicitud } from '../ai/tools/classification.tool';
import { crearPromptChatSoporte, crearPromptRankingGemini } from '../ai/prompts/ofiai.prompts';
import { geminiClient } from '../integrations/gemini';
import { logger } from '../config/logger';

export interface EntradaTrabajoIA {
  id?: string;
  empresaId?: string;
  titulo?: string;
  descripcion: string;
  categoria?: string;
  subcategoria?: string;
  habilidadesRequeridas?: string[];
  presupuestoMinimo?: number;
  presupuestoMaximo?: number;
  moneda?: string;
  tipoTrabajo?: 'presencial' | 'remoto' | 'hibrido';
  ciudad?: string;
}

export interface EntradaMatchingIA {
  trabajoId?: string;
  trabajo?: EntradaTrabajoIA;
  limite?: number;
  usarGemini?: boolean;
}

export interface ResultadoMatchingIA {
  trabajo: Pick<Trabajo, 'id' | 'titulo' | 'categoria' | 'subcategoria' | 'ciudad' | 'tipoTrabajo'>;
  ranking: ResultadoRankingProfesional[];
  recomendaciones: string[];
  motor: 'reglas' | 'reglas_gemini';
  mejoraGemini?: string;
}

export interface EntradaClasificacionIA {
  titulo?: string;
  descripcion: string;
  ciudad?: string;
}

export interface EntradaChatIA {
  mensaje: string;
  contexto?: string;
  usarGemini?: boolean;
}

export interface ResultadoChatIA {
  proveedor: 'reglas' | 'gemini';
  respuesta: string;
  accionesSugeridas: string[];
}

/**
 * Servicio principal de IA para operaciones de negocio.
 */
class AiService {
  private readonly limiteCandidatos = 250;

  /**
   * Ejecuta matching inteligente y actualiza el trabajo si proviene de Firestore.
   */
  async ejecutarMatching(entrada: EntradaMatchingIA, usuarioId: string, rol: RolUsuario): Promise<ResultadoMatchingIA> {
    const trabajo = await this.obtenerTrabajoParaIA(entrada, usuarioId, rol);
    const limite = this.normalizarLimite(entrada.limite);
    const profesionales = await this.obtenerProfesionalesCandidatos();
    const ranking = matchingAgent.recomendarProfesionales(trabajo, profesionales, limite);
    const recomendaciones = ranking.map((resultado) => resultado.profesional.id);
    let mejoraGemini: string | undefined;

    if (entrada.usarGemini && geminiClient.estaDisponible() && ranking.length > 0) {
      mejoraGemini = await this.obtenerMejoraGeminiRanking(trabajo, ranking);
    }

    if (entrada.trabajoId) {
      await firestore.collection(COLECCIONES.TRABAJOS).doc(entrada.trabajoId).update({
        profesionalesRecomendados: recomendaciones,
        puntajeMatchingIA: ranking[0]?.puntaje ?? 0,
        fechaActualizacion: new Date(),
      });
    }

    return {
      trabajo: {
        id: trabajo.id,
        titulo: trabajo.titulo,
        categoria: trabajo.categoria,
        subcategoria: trabajo.subcategoria,
        ciudad: trabajo.ciudad,
        tipoTrabajo: trabajo.tipoTrabajo,
      },
      ranking,
      recomendaciones,
      motor: mejoraGemini ? 'reglas_gemini' : 'reglas',
      mejoraGemini,
    };
  }

  /**
   * Obtiene recomendaciones usando el mismo motor de matching inicial.
   */
  async obtenerRecomendaciones(entrada: EntradaMatchingIA, usuarioId: string, rol: RolUsuario): Promise<ResultadoMatchingIA> {
    return this.ejecutarMatching(entrada, usuarioId, rol);
  }

  /**
   * Clasifica una solicitud de trabajo mediante reglas propias.
   */
  clasificarSolicitud(entrada: EntradaClasificacionIA): ResultadoClasificacionSolicitud {
    if (!entrada.descripcion?.trim()) {
      throw new ApiError('La descripción de la solicitud es obligatoria para clasificar.', 400);
    }

    return intakeAgent.clasificarSolicitud(entrada);
  }

  /**
   * Estima precio inicial usando categoría y complejidad detectada.
   */
  estimarPrecio(entrada: EntradaEstimacionPrecio): ResultadoEstimacionPrecio {
    if (!entrada.categoria?.trim()) {
      throw new ApiError('La categoría es obligatoria para estimar precio.', 400);
    }

    return pricingAgent.estimarPrecio(entrada);
  }

  /**
   * Ejecuta chat IA con Gemini opcional y fallback por reglas.
   */
  async chatear(entrada: EntradaChatIA, usuarioId: string, rol: RolUsuario): Promise<ResultadoChatIA> {
    if (!entrada.mensaje?.trim()) {
      throw new ApiError('El mensaje es obligatorio para usar el chat IA.', 400);
    }

    if (entrada.usarGemini && geminiClient.estaDisponible()) {
      const prompt = crearPromptChatSoporte(entrada.mensaje, {
        rolUsuario: rol,
        nombreUsuario: usuarioId,
        contexto: entrada.contexto,
      });
      const respuesta = await geminiClient.generarTexto({ prompt, temperatura: 0.3, maxTokens: 700 });

      return {
        proveedor: 'gemini',
        respuesta: respuesta.texto,
        accionesSugeridas: ['Revisar recomendación', 'Guardar contexto', 'Continuar conversación'],
      };
    }

    const respuestaReglas = supportAgent.responder({
      mensaje: entrada.mensaje,
      rolUsuario: rol,
      contexto: entrada.contexto,
    });

    return {
      proveedor: respuestaReglas.proveedor,
      respuesta: respuestaReglas.respuesta,
      accionesSugeridas: respuestaReglas.accionesSugeridas,
    };
  }

  /**
   * Obtiene trabajo desde Firestore o construye un trabajo virtual desde la entrada.
   */
  private async obtenerTrabajoParaIA(entrada: EntradaMatchingIA, usuarioId: string, rol: RolUsuario): Promise<Trabajo> {
    if (entrada.trabajoId) {
      const document = await firestore.collection(COLECCIONES.TRABAJOS).doc(entrada.trabajoId).get();
      const trabajo = document.exists ? document.data() as Trabajo : null;

      if (!trabajo) {
        throw new ApiError('Trabajo no encontrado para ejecutar matching.', 404);
      }

      await this.validarAccesoTrabajo(trabajo, usuarioId, rol);
      return trabajo;
    }

    if (!entrada.trabajo) {
      throw new ApiError('Debes enviar trabajoId o datos del trabajo para ejecutar matching.', 400);
    }

    return this.construirTrabajoVirtual(entrada.trabajo, usuarioId);
  }

  /**
   * Construye un trabajo temporal clasificado por reglas cuando todavía no fue publicado.
   */
  private construirTrabajoVirtual(entrada: EntradaTrabajoIA, usuarioId: string): Trabajo {
    const clasificacion = intakeAgent.clasificarSolicitud({
      titulo: entrada.titulo,
      descripcion: entrada.descripcion,
      ciudad: entrada.ciudad,
    });
    const fechaActual = new Date();

    return {
      id: entrada.id ?? `virtual-${Date.now()}`,
      empresaId: entrada.empresaId ?? usuarioId,
      titulo: entrada.titulo ?? clasificacion.resumen,
      descripcion: entrada.descripcion,
      categoria: entrada.categoria ?? clasificacion.categoria,
      subcategoria: entrada.subcategoria ?? clasificacion.subcategoria,
      habilidadesRequeridas: entrada.habilidadesRequeridas ?? clasificacion.habilidadesDetectadas,
      presupuestoMinimo: entrada.presupuestoMinimo,
      presupuestoMaximo: entrada.presupuestoMaximo,
      moneda: entrada.moneda ?? 'USD',
      tipoTrabajo: entrada.tipoTrabajo ?? 'presencial',
      ciudad: entrada.ciudad,
      estado: 'borrador',
      propuestasRecibidas: 0,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };
  }

  /**
   * Valida propiedad del trabajo para empresas y permite acceso total a administradores.
   */
  private async validarAccesoTrabajo(trabajo: Trabajo, usuarioId: string, rol: RolUsuario): Promise<void> {
    if (rol === 'admin') {
      return;
    }

    if (rol !== 'empresa') {
      throw new ApiError('Solo empresas y administradores pueden ejecutar matching sobre trabajos.', 403);
    }

    const snapshot = await firestore
      .collection(COLECCIONES.EMPRESAS)
      .where('usuarioId', '==', usuarioId)
      .limit(1)
      .get();
    const empresa = snapshot.docs[0]?.data() as Empresa | undefined;

    if (!empresa || empresa.id !== trabajo.empresaId) {
      throw new ApiError('No tienes autorización para ejecutar IA sobre este trabajo.', 403);
    }
  }

  /**
   * Obtiene candidatos activos para ranking inicial.
   */
  private async obtenerProfesionalesCandidatos(): Promise<Profesional[]> {
    const snapshot = await firestore
      .collection(COLECCIONES.PROFESIONALES)
      .where('disponible', '==', true)
      .limit(this.limiteCandidatos)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Profesional);
  }

  /**
   * Invoca Gemini para explicar ranking sin reemplazar el cálculo determinístico.
   */
  private async obtenerMejoraGeminiRanking(trabajo: Trabajo, ranking: ResultadoRankingProfesional[]): Promise<string | undefined> {
    try {
      const prompt = crearPromptRankingGemini(trabajo, ranking);
      const respuesta = await geminiClient.generarTexto({ prompt, temperatura: 0.2, maxTokens: 900 });
      return respuesta.texto;
    } catch (error) {
      logger.warn('Gemini no pudo mejorar el ranking; se mantiene resultado por reglas.', { error });
      return undefined;
    }
  }

  /**
   * Normaliza límite de resultados para proteger costos y latencia.
   */
  private normalizarLimite(limite?: number): number {
    if (!limite || !Number.isFinite(limite)) {
      return 10;
    }

    return Math.min(Math.max(Math.trunc(limite), 1), 25);
  }
}

export const aiService = new AiService();
