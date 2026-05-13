/**
 * Smoke test mínimo del bundle: los tipos generados existen y son válidos
 * runtime, los utilitarios de mapa cargan sin error.
 *
 * Esta suite intencionalmente NO testea componentes con deck.gl (incompatible
 * con jsdom por canvas/webgl). Para esos casos: integration con Playwright
 * o testing manual contra el dev server. CR-006 deja la infra puesta; los
 * tests de componentes ricos vienen en CRs siguientes.
 */
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('basic env is set up (jsdom present)', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  it('can import generated API types module', async () => {
    // Si openapi.json o gen-types están rotos, este import explota en compile.
    const mod = await import('../src/types/api');
    expect(mod).toBeDefined();
  });

  it('can import lib/regiones (chile bbox util)', async () => {
    const { isLatLonInRegion } = await import('../src/lib/regiones');
    // Lima está fuera del bbox de Chile RM
    expect(isLatLonInRegion(-12.04, -77.04, 'RM')).toBe(false);
    // Las Condes (RM) sí
    expect(isLatLonInRegion(-33.41, -70.58, 'RM')).toBe(true);
  });
});
