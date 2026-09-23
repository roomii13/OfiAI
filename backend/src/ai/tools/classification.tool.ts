/**
 * @archivo classification.tool.ts
 * @descripcion Herramienta de clasificación automática de solicitudes de trabajo para OfiAI.
 * Usa reglas transparentes para detectar categoría, subcategoría, prioridad, complejidad y habilidades.
 * @modulo AI Tools
 */

import { CATEGORIAS_OFICIOS } from '../../constants/jobCategories';

export type PrioridadSolicitud = 'baja' | 'media' | 'alta' | 'urgente';
export type ComplejidadSolicitud = 'simple' | 'media' | 'compleja';

export interface EntradaClasificacionSolicitud {
  titulo?: string;
  descripcion: string;
  ciudad?: string;
}

export interface ResultadoClasificacionSolicitud {
  categoria: string;
  subcategoria?: string;
  confianza: number;
  prioridad: PrioridadSolicitud;
  complejidad: ComplejidadSolicitud;
  habilidadesDetectadas: string[];
  resumen: string;
  requiereVisitaTecnica: boolean;
}

const PALABRAS_CLAVE: Record<string, string[]> = {
  construccion: ['obra', 'construccion', 'muro', 'pared', 'techo', 'losa', 'cemento', 'albanil', 'remodelacion'],
  instalaciones: ['instalacion', 'plomeria', 'gas', 'electricidad', 'cableado', 'cañeria', 'tuberia', 'aire acondicionado'],
  mantenimiento: ['mantenimiento', 'limpieza', 'jardin', 'fumigacion', 'reparacion', 'arreglo', 'preventivo'],
  tecnologia: ['red', 'wifi', 'camara', 'cctv', 'computadora', 'automatizacion', 'domotica', 'servidor'],
  acabados: ['piso', 'ceramica', 'ventana', 'puerta', 'closet', 'terminacion', 'pintura fina'],
  automotriz: ['auto', 'vehiculo', 'mecanica', 'carroceria', 'motor', 'freno', 'pintura auto'],
  salud: ['cuidado', 'adulto', 'enfermeria', 'fisioterapia', 'paciente', 'salud'],
  logistica: ['mudanza', 'flete', 'envio', 'mensajeria', 'traslado', 'carga'],
};

const PALABRAS_URGENCIA = ['urgente', 'hoy', 'inmediato', 'emergencia', '24 horas', 'ahora', 'riesgo'];
const PALABRAS_COMPLEJIDAD = ['industrial', 'certificado', 'plano', 'permiso', 'altura', 'trifasico', 'estructural', 'gasista'];

/**
 * Clasifica solicitudes de trabajo mediante reglas de dominio LATAM.
 */
class ClassificationTool {
  /**
   * Clasifica una solicitud textual en atributos útiles para publicación y matching.
   */
  clasificarSolicitud(entrada: EntradaClasificacionSolicitud): ResultadoClasificacionSolicitud {
    const texto = this.normalizar(`${entrada.titulo ?? ''} ${entrada.descripcion}`);
    const categoria = this.detectarCategoria(texto);
    const subcategoria = this.detectarSubcategoria(texto, categoria.id);
    const habilidadesDetectadas = this.detectarHabilidades(texto, categoria.id, subcategoria);

    return {
      categoria: categoria.id,
      subcategoria,
      confianza: categoria.confianza,
      prioridad: this.detectarPrioridad(texto),
      complejidad: this.detectarComplejidad(texto, habilidadesDetectadas.length),
      habilidadesDetectadas,
      resumen: this.generarResumen(entrada),
      requiereVisitaTecnica: this.requiereVisitaTecnica(texto),
    };
  }

  /**
   * Detecta la categoría más probable según palabras clave y catálogo oficial.
   */
  private detectarCategoria(texto: string): { id: string; confianza: number } {
    const puntajes = CATEGORIAS_OFICIOS.map((categoria) => {
      const claves = [...(PALABRAS_CLAVE[categoria.id] ?? []), categoria.id, categoria.nombre, ...categoria.subcategorias];
      const puntaje = claves.reduce((total, clave) => total + (texto.includes(this.normalizar(clave)) ? 1 : 0), 0);
      return { id: categoria.id, puntaje };
    }).sort((a, b) => b.puntaje - a.puntaje);

    const mejor = puntajes[0] ?? { id: 'mantenimiento', puntaje: 0 };
    const confianza = mejor.puntaje > 0 ? Math.min(0.95, 0.45 + mejor.puntaje * 0.12) : 0.35;

    return {
      id: mejor.puntaje > 0 ? mejor.id : 'mantenimiento',
      confianza: this.redondear(confianza),
    };
  }

  /**
   * Detecta subcategoría dentro de una categoría.
   */
  private detectarSubcategoria(texto: string, categoriaId: string): string | undefined {
    const categoria = CATEGORIAS_OFICIOS.find((item) => item.id === categoriaId);
    return categoria?.subcategorias.find((subcategoria) => texto.includes(this.normalizar(subcategoria)));
  }

  /**
   * Extrae habilidades detectables para nutrir el matching inicial.
   */
  private detectarHabilidades(texto: string, categoriaId: string, subcategoria?: string): string[] {
    const categoria = CATEGORIAS_OFICIOS.find((item) => item.id === categoriaId);
    const habilidades = new Set<string>();

    if (subcategoria) {
      habilidades.add(subcategoria);
    }

    categoria?.subcategorias.forEach((valor) => {
      if (texto.includes(this.normalizar(valor))) {
        habilidades.add(valor);
      }
    });

    (PALABRAS_CLAVE[categoriaId] ?? []).forEach((valor) => {
      if (texto.includes(this.normalizar(valor))) {
        habilidades.add(valor.replaceAll(' ', '_'));
      }
    });

    return [...habilidades].slice(0, 8);
  }

  /**
   * Estima prioridad de atención.
   */
  private detectarPrioridad(texto: string): PrioridadSolicitud {
    const coincidenciasUrgencia = PALABRAS_URGENCIA.filter((palabra) => texto.includes(this.normalizar(palabra))).length;

    if (coincidenciasUrgencia >= 2) {
      return 'urgente';
    }

    if (coincidenciasUrgencia === 1) {
      return 'alta';
    }

    return texto.length > 600 ? 'media' : 'baja';
  }

  /**
   * Estima complejidad operativa.
   */
  private detectarComplejidad(texto: string, totalHabilidades: number): ComplejidadSolicitud {
    const señalesComplejas = PALABRAS_COMPLEJIDAD.filter((palabra) => texto.includes(this.normalizar(palabra))).length;

    if (señalesComplejas >= 2 || totalHabilidades >= 5) {
      return 'compleja';
    }

    if (señalesComplejas === 1 || totalHabilidades >= 3 || texto.length > 450) {
      return 'media';
    }

    return 'simple';
  }

  /**
   * Genera un resumen corto para vistas administrativas.
   */
  private generarResumen(entrada: EntradaClasificacionSolicitud): string {
    const base = entrada.titulo?.trim() || entrada.descripcion.trim();
    return base.length > 160 ? `${base.slice(0, 157)}...` : base;
  }

  /**
   * Detecta si conviene una visita técnica previa a la cotización.
   */
  private requiereVisitaTecnica(texto: string): boolean {
    return ['presencial', 'medir', 'medicion', 'visita', 'obra', 'gas', 'estructura', 'humedad'].some((palabra) =>
      texto.includes(this.normalizar(palabra))
    );
  }

  /**
   * Normaliza texto para matching tolerante a acentos y mayúsculas.
   */
  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Redondea un número a dos decimales.
   */
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}

export const classificationTool = new ClassificationTool();
