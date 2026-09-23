/**
 * @archivo index.ts
 * @descripcion Integración con Google Maps Platform para OfiAI.
 * Implementa geocodificación, cálculo de distancia y búsqueda geográfica por radio.
 * @modulo Integrations
 */

import { env } from '../../config/env';

const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api';

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface ResultadoGeocodificacion {
  direccionFormateada: string;
  coordenadas: Coordenadas;
  placeId: string;
}

export interface EntidadGeolocalizada {
  id: string;
  coordenadas?: Coordenadas;
}

export interface EntidadEnRadio<T extends EntidadGeolocalizada> {
  entidad: T;
  distanciaKm: number;
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: Array<{
    formatted_address: string;
    place_id: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

/**
 * Indica si Google Maps está configurado para llamadas externas.
 */
export const googleMapsDisponible = (): boolean => Boolean(env.GOOGLE_MAPS_API_KEY);

/**
 * Geocodifica una dirección usando Google Maps Geocoding API.
 */
export const geocodificarDireccion = async (direccion: string): Promise<ResultadoGeocodificacion> => {
  if (!googleMapsDisponible()) {
    throw new Error('Google Maps no está configurado. Define GOOGLE_MAPS_API_KEY.');
  }

  const params = new URLSearchParams({
    address: direccion,
    key: env.GOOGLE_MAPS_API_KEY,
    language: 'es-419',
  });
  const response = await fetch(`${GOOGLE_MAPS_API_URL}/geocode/json?${params.toString()}`);
  const data = await response.json() as GoogleGeocodeResponse;

  if (!response.ok || data.status !== 'OK' || data.results.length === 0) {
    throw new Error(data.error_message ?? `Google Maps no pudo geocodificar la dirección. Estado: ${data.status}`);
  }

  const resultado = data.results[0]!;

  return {
    direccionFormateada: resultado.formatted_address,
    placeId: resultado.place_id,
    coordenadas: {
      latitud: resultado.geometry.location.lat,
      longitud: resultado.geometry.location.lng,
    },
  };
};

/**
 * Calcula distancia geográfica en kilómetros con fórmula Haversine.
 */
export const calcularDistanciaKm = (origen: Coordenadas, destino: Coordenadas): number => {
  const radioTierraKm = 6371;
  const deltaLatitud = gradosARadianes(destino.latitud - origen.latitud);
  const deltaLongitud = gradosARadianes(destino.longitud - origen.longitud);
  const latitudOrigen = gradosARadianes(origen.latitud);
  const latitudDestino = gradosARadianes(destino.latitud);
  const haversine = Math.sin(deltaLatitud / 2) ** 2 +
    Math.cos(latitudOrigen) * Math.cos(latitudDestino) * Math.sin(deltaLongitud / 2) ** 2;
  const distancia = 2 * radioTierraKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round((distancia + Number.EPSILON) * 100) / 100;
};

/**
 * Busca entidades con coordenadas dentro de un radio determinado.
 */
export const buscarEntidadesEnRadio = <T extends EntidadGeolocalizada>(
  origen: Coordenadas,
  entidades: T[],
  radioKm: number
): EntidadEnRadio<T>[] => {
  return entidades
    .filter((entidad) => Boolean(entidad.coordenadas))
    .map((entidad) => ({
      entidad,
      distanciaKm: calcularDistanciaKm(origen, entidad.coordenadas as Coordenadas),
    }))
    .filter((resultado) => resultado.distanciaKm <= radioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
};

/**
 * Convierte grados a radianes.
 */
const gradosARadianes = (grados: number): number => grados * Math.PI / 180;
