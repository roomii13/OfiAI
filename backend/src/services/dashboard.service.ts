import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo dashboard.service.ts
 * @descripcion Servicio de negocio para dashboards operativos de OfiAI.
 * Centraliza KPIs, estadísticas, actividad reciente, resumen de trabajos y métricas por rol.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Empresa } from '../models/Company';
import { Trabajo, EstadoTrabajo } from '../models/Job';
import { Profesional } from '../models/Professional';
import { Propuesta, EstadoPropuesta } from '../models/Proposal';
import { Suscripcion } from '../models/Subscription';
import { Usuario } from '../models/User';

type RolDashboard = 'empresa' | 'profesional' | 'admin';

interface ActividadReciente {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  fecha: string;
}

interface DistribucionNumerica {
  etiqueta: string;
  total: number;
}

interface ResumenTrabajo {
  total: number;
  borrador: number;
  publicado: number;
  enRevision: number;
  enProgreso: number;
  completado: number;
  cancelado: number;
}

interface DashboardBase<TKpis extends Record<string, number | boolean | string>, TMetricas extends Record<string, number | string>> {
  rol: RolDashboard;
  kpis: TKpis;
  estadisticas: {
    trabajosPorEstado: DistribucionNumerica[];
    trabajosPorCategoria: DistribucionNumerica[];
    trabajosPorTipo: DistribucionNumerica[];
  };
  actividadReciente: ActividadReciente[];
  resumenTrabajos: ResumenTrabajo;
  metricas: TMetricas;
}

interface DashboardEmpresa extends DashboardBase<
  {
    trabajosTotales: number;
    trabajosActivos: number;
    trabajosCompletados: number;
    propuestasRecibidas: number;
    contratacionesTotales: number;
    calificacionPromedio: number;
    suscripcionActiva: boolean;
  },
  {
    tasaFinalizacion: number;
    promedioPropuestasPorTrabajo: number;
    presupuestoPromedio: number;
    trabajosPublicadosUltimos30Dias: number;
  }
> {
  empresa: Pick<Empresa, 'id' | 'nombreEmpresa' | 'industria' | 'pais' | 'ciudad' | 'planSuscripcion'>;
}

interface DashboardProfesional extends DashboardBase<
  {
    trabajosAsignados: number;
    trabajosCompletados: number;
    propuestasEnviadas: number;
    propuestasAceptadas: number;
    calificacionPromedio: number;
    disponible: boolean;
    verificado: boolean;
  },
  {
    tasaAceptacion: number;
    tasaFinalizacion: number;
    ingresosEstimados: number;
    puntajeReputacion: number;
  }
> {
  profesional: Pick<Profesional, 'id' | 'nombre' | 'apellido' | 'especialidades' | 'ciudad' | 'pais'>;
}

interface DashboardAdministrador extends DashboardBase<
  {
    usuariosTotales: number;
    empresasActivas: number;
    profesionalesActivos: number;
    trabajosTotales: number;
    trabajosActivos: number;
    suscripcionesActivas: number;
    ingresosMensualesEstimados: number;
  },
  {
    tasaTrabajosCompletados: number;
    tasaProfesionalesVerificados: number;
    tasaSuscripcionesActivas: number;
    crecimientoUsuariosUltimos30Dias: number;
  }
> {
  plataforma: {
    fechaGeneracion: string;
    monedaBase: string;
  };
}

/**
 * Servicio de dashboards con consultas agregadas sobre Firestore.
 */
class DashboardService {
  private readonly limiteLecturaDashboard = 250;

  /**
   * Genera el dashboard para una empresa autenticada o consultada por un administrador.
   */
  async obtenerDashboardEmpresa(usuarioId: string, rol: RolDashboard, empresaId?: string): Promise<DashboardEmpresa> {
    const empresa = await this.obtenerEmpresaParaDashboard(usuarioId, rol, empresaId);
    const trabajos = await this.obtenerTrabajosPorEmpresa(empresa.id);
    const resumenTrabajos = this.crearResumenTrabajos(trabajos);
    const propuestasRecibidas = trabajos.reduce((total, trabajo) => total + this.normalizarNumero(trabajo.propuestasRecibidas), 0);
    const presupuestos = trabajos
      .map((trabajo) => this.obtenerPresupuestoReferencia(trabajo))
      .filter((monto): monto is number => monto > 0);

    return {
      rol: 'empresa',
      empresa: {
        id: empresa.id,
        nombreEmpresa: empresa.nombreEmpresa,
        industria: empresa.industria,
        pais: empresa.pais,
        ciudad: empresa.ciudad,
        planSuscripcion: empresa.planSuscripcion,
      },
      kpis: {
        trabajosTotales: trabajos.length,
        trabajosActivos: resumenTrabajos.publicado + resumenTrabajos.enRevision + resumenTrabajos.enProgreso,
        trabajosCompletados: resumenTrabajos.completado,
        propuestasRecibidas,
        contratacionesTotales: this.normalizarNumero(empresa.totalContrataciones),
        calificacionPromedio: this.redondear(this.normalizarNumero(empresa.calificacionPromedio)),
        suscripcionActiva: Boolean(empresa.suscripcionActiva),
      },
      estadisticas: this.crearEstadisticasTrabajos(trabajos),
      actividadReciente: this.crearActividadDesdeTrabajos(trabajos),
      resumenTrabajos,
      metricas: {
        tasaFinalizacion: this.calcularPorcentaje(resumenTrabajos.completado, trabajos.length),
        promedioPropuestasPorTrabajo: this.redondear(trabajos.length > 0 ? propuestasRecibidas / trabajos.length : 0),
        presupuestoPromedio: this.promediar(presupuestos),
        trabajosPublicadosUltimos30Dias: trabajos.filter((trabajo) => this.estaDentroDeUltimosDias(trabajo.fechaCreacion, 30)).length,
      },
    };
  }

  /**
   * Genera el dashboard para un profesional autenticado o consultado por un administrador.
   */
  async obtenerDashboardProfesional(usuarioId: string, rol: RolDashboard, profesionalId?: string): Promise<DashboardProfesional> {
    const profesional = await this.obtenerProfesionalParaDashboard(usuarioId, rol, profesionalId);
    const [trabajosAsignados, propuestas] = await Promise.all([
      this.obtenerTrabajosPorProfesional(profesional.id),
      this.obtenerPropuestasPorProfesional(profesional.id),
    ]);
    const resumenTrabajos = this.crearResumenTrabajos(trabajosAsignados);
    const propuestasAceptadas = propuestas.filter((propuesta) => propuesta.estado === 'aceptada').length;
    const ingresosEstimados = propuestas
      .filter((propuesta) => propuesta.estado === 'aceptada')
      .reduce((total, propuesta) => total + this.normalizarNumero(propuesta.precioOfertado), 0);

    return {
      rol: 'profesional',
      profesional: {
        id: profesional.id,
        nombre: profesional.nombre,
        apellido: profesional.apellido,
        especialidades: profesional.especialidades,
        ciudad: profesional.ciudad,
        pais: profesional.pais,
      },
      kpis: {
        trabajosAsignados: trabajosAsignados.length,
        trabajosCompletados: resumenTrabajos.completado,
        propuestasEnviadas: propuestas.length,
        propuestasAceptadas,
        calificacionPromedio: this.redondear(this.normalizarNumero(profesional.calificacionPromedio)),
        disponible: Boolean(profesional.disponible),
        verificado: Boolean(profesional.verificado),
      },
      estadisticas: this.crearEstadisticasTrabajos(trabajosAsignados),
      actividadReciente: [
        ...this.crearActividadDesdeTrabajos(trabajosAsignados),
        ...this.crearActividadDesdePropuestas(propuestas),
      ]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 10),
      resumenTrabajos,
      metricas: {
        tasaAceptacion: this.calcularPorcentaje(propuestasAceptadas, propuestas.length),
        tasaFinalizacion: this.calcularPorcentaje(resumenTrabajos.completado, trabajosAsignados.length),
        ingresosEstimados: this.redondear(ingresosEstimados),
        puntajeReputacion: this.redondear(this.normalizarNumero(profesional.puntajeReputacionIA ?? profesional.calificacionPromedio * 20)),
      },
    };
  }

  /**
   * Genera el dashboard global para administradores de la plataforma.
   */
  async obtenerDashboardAdministrador(): Promise<DashboardAdministrador> {
    const [usuarios, empresas, profesionales, trabajos, suscripciones] = await Promise.all([
      this.obtenerDocumentos<Usuario>(COLECCIONES.USUARIOS),
      this.obtenerDocumentos<Empresa>(COLECCIONES.EMPRESAS),
      this.obtenerDocumentos<Profesional>(COLECCIONES.PROFESIONALES),
      this.obtenerDocumentos<Trabajo>(COLECCIONES.TRABAJOS),
      this.obtenerDocumentos<Suscripcion>(COLECCIONES.SUSCRIPCIONES),
    ]);

    const empresasActivas = empresas.filter((empresa) => empresa.activo !== false);
    const profesionalesActivos = profesionales.filter((profesional) => profesional.disponible !== false);
    const suscripcionesActivas = suscripciones.filter((suscripcion) => suscripcion.estado === 'activa');
    const resumenTrabajos = this.crearResumenTrabajos(trabajos);
    const ingresosMensualesEstimados = suscripcionesActivas.reduce(
      (total, suscripcion) => total + this.normalizarNumero(suscripcion.precioMensual),
      0
    );

    return {
      rol: 'admin',
      plataforma: {
        fechaGeneracion: new Date().toISOString(),
        monedaBase: 'USD',
      },
      kpis: {
        usuariosTotales: usuarios.length,
        empresasActivas: empresasActivas.length,
        profesionalesActivos: profesionalesActivos.length,
        trabajosTotales: trabajos.length,
        trabajosActivos: resumenTrabajos.publicado + resumenTrabajos.enRevision + resumenTrabajos.enProgreso,
        suscripcionesActivas: suscripcionesActivas.length,
        ingresosMensualesEstimados: this.redondear(ingresosMensualesEstimados),
      },
      estadisticas: this.crearEstadisticasTrabajos(trabajos),
      actividadReciente: this.crearActividadDesdeTrabajos(trabajos),
      resumenTrabajos,
      metricas: {
        tasaTrabajosCompletados: this.calcularPorcentaje(resumenTrabajos.completado, trabajos.length),
        tasaProfesionalesVerificados: this.calcularPorcentaje(
          profesionales.filter((profesional) => profesional.verificado).length,
          profesionales.length
        ),
        tasaSuscripcionesActivas: this.calcularPorcentaje(suscripcionesActivas.length, suscripciones.length),
        crecimientoUsuariosUltimos30Dias: usuarios.filter((usuario) => this.estaDentroDeUltimosDias(usuario.fechaCreacion, 30)).length,
      },
    };
  }

  /**
   * Obtiene una empresa según el rol y alcance permitido.
   */
  private async obtenerEmpresaParaDashboard(usuarioId: string, rol: RolDashboard, empresaId?: string): Promise<Empresa> {
    if (rol === 'admin' && empresaId) {
      const empresa = await this.obtenerDocumentoPorId<Empresa>(COLECCIONES.EMPRESAS, empresaId);
      if (!empresa || empresa.activo === false) {
        throw new ApiError('Empresa no encontrada para generar dashboard.', 404);
      }
      return empresa;
    }

    const snapshot = await firestore
      .collection(COLECCIONES.EMPRESAS)
      .where('usuarioId', '==', usuarioId)
      .limit(1)
      .get();
    const empresa = snapshot.docs[0]?.data() as Empresa | undefined;

    if (!empresa || empresa.activo === false) {
      throw new ApiError('No existe una empresa activa asociada al usuario autenticado.', 404);
    }

    return empresa;
  }

  /**
   * Obtiene un profesional según el rol y alcance permitido.
   */
  private async obtenerProfesionalParaDashboard(usuarioId: string, rol: RolDashboard, profesionalId?: string): Promise<Profesional> {
    if (rol === 'admin' && profesionalId) {
      const profesional = await this.obtenerDocumentoPorId<Profesional>(COLECCIONES.PROFESIONALES, profesionalId);
      if (!profesional) {
        throw new ApiError('Profesional no encontrado para generar dashboard.', 404);
      }
      return profesional;
    }

    const snapshot = await firestore
      .collection(COLECCIONES.PROFESIONALES)
      .where('usuarioId', '==', usuarioId)
      .limit(1)
      .get();
    const profesional = snapshot.docs[0]?.data() as Profesional | undefined;

    if (!profesional) {
      throw new ApiError('No existe un perfil profesional asociado al usuario autenticado.', 404);
    }

    return profesional;
  }

  /**
   * Obtiene trabajos creados por una empresa.
   */
  private async obtenerTrabajosPorEmpresa(empresaId: string): Promise<Trabajo[]> {
    const snapshot = await firestore
      .collection(COLECCIONES.TRABAJOS)
      .where('empresaId', '==', empresaId)
      .limit(this.limiteLecturaDashboard)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Trabajo);
  }

  /**
   * Obtiene trabajos asignados a un profesional.
   */
  private async obtenerTrabajosPorProfesional(profesionalId: string): Promise<Trabajo[]> {
    const snapshot = await firestore
      .collection(COLECCIONES.TRABAJOS)
      .where('profesionalAsignadoId', '==', profesionalId)
      .limit(this.limiteLecturaDashboard)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Trabajo);
  }

  /**
   * Obtiene propuestas enviadas por un profesional.
   */
  private async obtenerPropuestasPorProfesional(profesionalId: string): Promise<Propuesta[]> {
    const snapshot = await firestore
      .collection(COLECCIONES.PROPUESTAS)
      .where('profesionalId', '==', profesionalId)
      .limit(this.limiteLecturaDashboard)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Propuesta);
  }

  /**
   * Obtiene documentos de una colección acotados al uso de dashboards.
   */
  private async obtenerDocumentos<T>(coleccion: string): Promise<T[]> {
    const snapshot = await firestore.collection(coleccion).limit(this.limiteLecturaDashboard).get();
    return snapshot.docs.map((doc) => doc.data() as T);
  }

  /**
   * Obtiene un documento por ID desde Firestore.
   */
  private async obtenerDocumentoPorId<T>(coleccion: string, id: string): Promise<T | null> {
    const document = await firestore.collection(coleccion).doc(id).get();
    return document.exists ? (document.data() as T) : null;
  }

  /**
   * Agrupa trabajos por estado, categoría y modalidad.
   */
  private crearEstadisticasTrabajos(trabajos: Trabajo[]): DashboardEmpresa['estadisticas'] {
    return {
      trabajosPorEstado: this.crearDistribucion(trabajos.map((trabajo) => trabajo.estado)),
      trabajosPorCategoria: this.crearDistribucion(trabajos.map((trabajo) => trabajo.categoria || 'sin_categoria')),
      trabajosPorTipo: this.crearDistribucion(trabajos.map((trabajo) => trabajo.tipoTrabajo || 'sin_tipo')),
    };
  }

  /**
   * Crea un resumen numérico de trabajos por estado.
   */
  private crearResumenTrabajos(trabajos: Trabajo[]): ResumenTrabajo {
    const estados: EstadoTrabajo[] = ['borrador', 'publicado', 'en_revision', 'en_progreso', 'completado', 'cancelado'];
    const totales = new Map<EstadoTrabajo, number>(estados.map((estado) => [estado, 0]));

    trabajos.forEach((trabajo) => {
      totales.set(trabajo.estado, (totales.get(trabajo.estado) ?? 0) + 1);
    });

    return {
      total: trabajos.length,
      borrador: totales.get('borrador') ?? 0,
      publicado: totales.get('publicado') ?? 0,
      enRevision: totales.get('en_revision') ?? 0,
      enProgreso: totales.get('en_progreso') ?? 0,
      completado: totales.get('completado') ?? 0,
      cancelado: totales.get('cancelado') ?? 0,
    };
  }

  /**
   * Transforma trabajos recientes en eventos de actividad.
   */
  private crearActividadDesdeTrabajos(trabajos: Trabajo[]): ActividadReciente[] {
    return [...trabajos]
      .sort((a, b) => this.obtenerTiempo(b.fechaActualizacion ?? b.fechaCreacion) - this.obtenerTiempo(a.fechaActualizacion ?? a.fechaCreacion))
      .slice(0, 10)
      .map((trabajo) => ({
        id: trabajo.id,
        tipo: 'trabajo',
        titulo: trabajo.titulo,
        descripcion: `Trabajo ${trabajo.estado} en ${trabajo.categoria}`,
        fecha: this.convertirFecha(trabajo.fechaActualizacion ?? trabajo.fechaCreacion),
      }));
  }

  /**
   * Transforma propuestas recientes en eventos de actividad.
   */
  private crearActividadDesdePropuestas(propuestas: Propuesta[]): ActividadReciente[] {
    return [...propuestas]
      .sort((a, b) => this.obtenerTiempo(b.fechaEnvio) - this.obtenerTiempo(a.fechaEnvio))
      .slice(0, 10)
      .map((propuesta) => ({
        id: propuesta.id,
        tipo: 'propuesta',
        titulo: `Propuesta ${this.formatearEstadoPropuesta(propuesta.estado)}`,
        descripcion: `Oferta enviada por ${propuesta.moneda} ${this.redondear(propuesta.precioOfertado)}`,
        fecha: this.convertirFecha(propuesta.fechaEnvio),
      }));
  }

  /**
   * Cuenta ocurrencias por etiqueta.
   */
  private crearDistribucion(valores: string[]): DistribucionNumerica[] {
    const conteo = valores.reduce<Map<string, number>>((acumulado, valor) => {
      acumulado.set(valor, (acumulado.get(valor) ?? 0) + 1);
      return acumulado;
    }, new Map<string, number>());

    return [...conteo.entries()]
      .map(([etiqueta, total]) => ({ etiqueta, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Calcula un porcentaje con dos decimales.
   */
  private calcularPorcentaje(valor: number, total: number): number {
    return total > 0 ? this.redondear((valor / total) * 100) : 0;
  }

  /**
   * Calcula un promedio numérico con dos decimales.
   */
  private promediar(valores: number[]): number {
    if (valores.length === 0) {
      return 0;
    }

    return this.redondear(valores.reduce((total, valor) => total + valor, 0) / valores.length);
  }

  /**
   * Obtiene un presupuesto representativo para métricas.
   */
  private obtenerPresupuestoReferencia(trabajo: Trabajo): number {
    const minimo = this.normalizarNumero(trabajo.presupuestoMinimo);
    const maximo = this.normalizarNumero(trabajo.presupuestoMaximo);

    if (minimo > 0 && maximo > 0) {
      return (minimo + maximo) / 2;
    }

    return maximo || minimo;
  }

  /**
   * Verifica si una fecha está dentro de una ventana reciente.
   */
  private estaDentroDeUltimosDias(fecha: Date | FirebaseFirestore.Timestamp | undefined, dias: number): boolean {
    const tiempo = this.obtenerTiempo(fecha);
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return tiempo >= limite;
  }

  /**
   * Convierte una fecha o Timestamp Firestore en cadena ISO.
   */
  private convertirFecha(fecha: Date | FirebaseFirestore.Timestamp | undefined): string {
    const tiempo = this.obtenerTiempo(fecha);
    return new Date(tiempo || Date.now()).toISOString();
  }

  /**
   * Obtiene el tiempo Unix en milisegundos desde Date o Timestamp Firestore.
   */
  private obtenerTiempo(fecha: Date | FirebaseFirestore.Timestamp | undefined): number {
    if (!fecha) {
      return 0;
    }

    if (fecha instanceof Date) {
      return fecha.getTime();
    }

    return fecha.toDate().getTime();
  }

  /**
   * Normaliza valores potencialmente ausentes a números finitos.
   */
  private normalizarNumero(valor: number | undefined): number {
    return Number.isFinite(valor) ? Number(valor) : 0;
  }

  /**
   * Redondea un valor numérico a dos decimales.
   */
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  /**
   * Convierte estados internos de propuestas en texto legible.
   */
  private formatearEstadoPropuesta(estado: EstadoPropuesta): string {
    return estado.replace('_', ' ');
  }
}

export const dashboardService = new DashboardService();
