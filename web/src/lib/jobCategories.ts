/**
 * @archivo jobCategories.ts
 * @descripcion Catalogo sugerido para publicar trabajos; admite categorias libres.
 */

/** Grupos de oficios, conservando los valores de las cuatro opciones originales. */
export const JOB_CATEGORY_GROUPS = [
  {
    label: "Servicios generales",
    categories: [
      { value: "Mantenimiento", label: "Mantenimiento" },
      { value: "Electricidad", label: "Electricidad" },
      { value: "Plomeria", label: "Plomer\u00eda" },
      { value: "Tecnologia", label: "Tecnolog\u00eda" },
    ],
  },
  {
    label: "Construcci\u00f3n y terminaciones",
    categories: [
      { value: "Alba\u00f1iler\u00eda", label: "Alba\u00f1iler\u00eda" },
      { value: "Carpinter\u00eda", label: "Carpinter\u00eda" },
      { value: "Pintura", label: "Pintura" },
      { value: "Herrer\u00eda", label: "Herrer\u00eda" },
      { value: "Soldadura", label: "Soldadura" },
      { value: "Yeser\u00eda", label: "Yeser\u00eda" },
      { value: "Impermeabilizaci\u00f3n", label: "Impermeabilizaci\u00f3n" },
      { value: "Reparaci\u00f3n de techos", label: "Reparaci\u00f3n de techos" },
      { value: "Colocaci\u00f3n de pisos", label: "Colocaci\u00f3n de pisos" },
      { value: "Vidrier\u00eda", label: "Vidrier\u00eda" },
    ],
  },
  {
    label: "Instalaciones y seguridad",
    categories: [
      { value: "Gasista", label: "Gasista" },
      { value: "Aire acondicionado", label: "Aire acondicionado" },
      { value: "Calefacci\u00f3n", label: "Calefacci\u00f3n" },
      { value: "Refrigeraci\u00f3n", label: "Refrigeraci\u00f3n" },
      { value: "Energ\u00eda solar", label: "Energ\u00eda solar" },
      { value: "Cerrajer\u00eda", label: "Cerrajer\u00eda" },
      { value: "Automatizaci\u00f3n", label: "Automatizaci\u00f3n" },
      { value: "C\u00e1maras de seguridad", label: "C\u00e1maras de seguridad" },
      { value: "Alarmas", label: "Alarmas" },
      { value: "Redes e internet", label: "Redes e internet" },
    ],
  },
  {
    label: "Limpieza y espacios verdes",
    categories: [
      { value: "Limpieza del hogar", label: "Limpieza del hogar" },
      { value: "Limpieza industrial", label: "Limpieza industrial" },
      { value: "Limpieza final de obra", label: "Limpieza final de obra" },
      { value: "Jardiner\u00eda", label: "Jardiner\u00eda" },
      { value: "Paisajismo", label: "Paisajismo" },
      { value: "Poda", label: "Poda" },
      { value: "Fumigaci\u00f3n", label: "Fumigaci\u00f3n" },
      { value: "Mantenimiento de piscinas", label: "Mantenimiento de piscinas" },
    ],
  },
  {
    label: "Reparaciones y transporte",
    categories: [
      { value: "Reparaci\u00f3n de electrodom\u00e9sticos", label: "Reparaci\u00f3n de electrodom\u00e9sticos" },
      { value: "Reparaci\u00f3n de computadoras", label: "Reparaci\u00f3n de computadoras" },
      { value: "Reparaci\u00f3n de celulares", label: "Reparaci\u00f3n de celulares" },
      { value: "Mec\u00e1nica automotriz", label: "Mec\u00e1nica automotriz" },
      { value: "Electricidad automotriz", label: "Electricidad automotriz" },
      { value: "Chapa y pintura", label: "Chapa y pintura" },
      { value: "Mudanzas", label: "Mudanzas" },
      { value: "Fletes", label: "Fletes" },
    ],
  },
  {
    label: "Servicios personales y comerciales",
    categories: [
      { value: "Mensajer\u00eda", label: "Mensajer\u00eda" },
      { value: "Montaje de muebles", label: "Montaje de muebles" },
      { value: "Tapicer\u00eda", label: "Tapicer\u00eda" },
      { value: "Costura y confecci\u00f3n", label: "Costura y confecci\u00f3n" },
      { value: "Gastronom\u00eda y catering", label: "Gastronom\u00eda y catering" },
      { value: "Organizaci\u00f3n de eventos", label: "Organizaci\u00f3n de eventos" },
      { value: "Fotograf\u00eda", label: "Fotograf\u00eda" },
      { value: "Cuidado de adultos mayores", label: "Cuidado de adultos mayores" },
      { value: "Cuidado de ni\u00f1os", label: "Cuidado de ni\u00f1os" },
      { value: "Asistencia administrativa", label: "Asistencia administrativa" },
    ],
  },
] as const;

