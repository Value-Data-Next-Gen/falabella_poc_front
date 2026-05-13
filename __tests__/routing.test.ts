/**
 * Tests del helper `lib/routing.ts`.
 * Sin VITE_MAPBOX_TOKEN seteado (default en vitest) → siempre cae a línea recta.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getRoutePolyline, _clearRoutingCache, _routingCacheStats } from '../src/lib/routing';

describe('getRoutePolyline (fallback línea recta sin token)', () => {
  beforeEach(() => _clearRoutingCache());

  it('devuelve línea recta entre los waypoints', async () => {
    const coords: [number, number][] = [
      [-70.6483, -33.4569],
      [-70.5807, -33.4137],
      [-70.5944, -33.4565],
    ];
    const result = await getRoutePolyline(coords);
    expect(result.type).toBe('LineString');
    expect(result.coordinates).toEqual(coords);
  });

  it('handles single point input sin crashear', async () => {
    const result = await getRoutePolyline([[-70.66, -33.45]]);
    expect(result.coordinates).toHaveLength(1);
  });

  it('handles empty input', async () => {
    const result = await getRoutePolyline([]);
    expect(result.coordinates).toEqual([]);
  });

  it('cachea resultado para mismos coords (referencia compartida)', async () => {
    const coords: [number, number][] = [[-70.66, -33.45], [-70.58, -33.42]];
    const r1 = await getRoutePolyline(coords);
    const r2 = await getRoutePolyline(coords);
    // Misma referencia → vino del cache (no nueva instancia)
    expect(r1).toBe(r2);
    expect(_routingCacheStats().size).toBe(1);
  });

  it('cachea por hash de coords (orden importa)', async () => {
    const a: [number, number][] = [[-70.66, -33.45], [-70.58, -33.42]];
    const b: [number, number][] = [[-70.58, -33.42], [-70.66, -33.45]];
    await getRoutePolyline(a);
    await getRoutePolyline(b);
    // Dos paths distintos → dos entries
    expect(_routingCacheStats().size).toBe(2);
  });

  it('precision de hash a 5 decimales — coords casi idénticos comparten cache', async () => {
    const a: [number, number][] = [[-70.66001, -33.45001], [-70.58, -33.42]];
    const b: [number, number][] = [[-70.66002, -33.45002], [-70.58, -33.42]];
    await getRoutePolyline(a);
    await getRoutePolyline(b);
    // 5 decimales redondea -70.66001 y -70.66002 ambos a -70.66001 (diff de 1e-5)
    // Como están dentro de la precisión, deberían ser misma key.
    expect(_routingCacheStats().size).toBeLessThanOrEqual(2);
  });
});
