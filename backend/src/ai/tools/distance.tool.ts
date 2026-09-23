/**
 * @archivo distance.tool.ts
 * @descripcion Distancia geodesica local; reemplazable por un proveedor de rutas sin cambiar el scoring.
 */
export interface Coordinates { latitude: number; longitude: number }
/** Calcula Haversine en kilometros; devuelve null ante coordenadas ausentes o invalidas. */
export function calculateDistanceKm(a?: Coordinates | null, b?: Coordinates | null): number | null {
  if (!a || !b || [a, b].some(p => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) return null;
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}

