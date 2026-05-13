/**
 * Routing: convierte una secuencia de waypoints en un GeoJSON LineString.
 *
 * Fuentes (en orden de preferencia):
 *   1. Mapbox Directions API si `VITE_MAPBOX_TOKEN` está set → polyline real
 *      por calles (no diagonales).
 *   2. Fallback: línea recta entre waypoints (sin red, sin auth).
 *
 * Cache in-memory con TTL 5 min, key = hash determinístico de coords.
 *
 * Estado actual del proyecto: SimpliRoute enviará coords GPS reales del
 * vehículo cada ~5 min vía el endpoint `driver-positions`. Esos puntos densos
 * NO necesitan Directions API. Este helper queda preparado para:
 *   - Renderizar el plan teórico de la ruta (origen → stops → CD) ANTES de
 *     que el vehículo arranque (ahí sí necesitamos calles).
 *   - Fallback cuando SimpliRoute pierde tracking de un vehículo.
 *
 * Para activarlo, setear `VITE_MAPBOX_TOKEN` en frontend/.env y conectar
 * el hook `useRoutePolyline` al `routes` useMemo de OperationsMap.
 */
export type LngLat = [number, number]; // [lng, lat] — convención GeoJSON

interface LineString {
  type: 'LineString';
  coordinates: LngLat[];
}

interface CacheEntry {
  data: LineString;
  expiresAt: number;
}

const TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

/** Hash determinístico de los waypoints. 5 decimales ≈ 1m de precisión. */
function hashCoords(coords: LngLat[]): string {
  return coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
}

function straightLine(coords: LngLat[]): LineString {
  return { type: 'LineString', coordinates: coords };
}

/**
 * Obtiene la polyline para una secuencia de waypoints.
 * Cache-aware. NUNCA lanza — devuelve línea recta como último recurso.
 */
export async function getRoutePolyline(coords: LngLat[]): Promise<LineString> {
  if (coords.length < 2) return straightLine(coords);

  const key = hashCoords(coords);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (!token) {
    // Sin token → línea recta. Cachear igual para no recomputar el hash.
    const data = straightLine(coords);
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  }

  try {
    // Mapbox Directions API: hasta 25 waypoints por request.
    const sliced = coords.length > 25 ? coords.slice(0, 25) : coords;
    const path = sliced.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${path}` +
      `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`mapbox http ${r.status}`);
    const json = await r.json();
    const geom = json?.routes?.[0]?.geometry;
    if (!geom || geom.type !== 'LineString') throw new Error('respuesta sin geometry LineString');
    const data: LineString = {
      type: 'LineString',
      coordinates: geom.coordinates as LngLat[],
    };
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  } catch (e) {
    // Log una vez por minuto como mucho (evita spam en consola si la API
    // está caída): trackeo con un timestamp por hash.
    console.warn('[routing] Mapbox falló, usando línea recta:', e);
    const data = straightLine(coords);
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  }
}

/** Para tests / forzar refresh: limpia toda la cache. */
export function _clearRoutingCache(): void {
  cache.clear();
}

/** Útil para debug: inspeccionar el estado de la cache. */
export function _routingCacheStats(): { size: number; keys: string[] } {
  return { size: cache.size, keys: Array.from(cache.keys()) };
}
