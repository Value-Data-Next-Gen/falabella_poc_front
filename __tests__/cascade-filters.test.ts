/**
 * Tests unitarios PUROS de la lógica de cascade driver↔ruta usada en
 * `components/modules/OperacionModuleV2.tsx → MapaTab`.
 *
 * Extracto la lógica como función pura para testearla sin renderizar el
 * componente (deck.gl + react-map-gl no funcionan en jsdom). Los tests
 * documentan el contrato esperado y previenen regresiones cuando se toca
 * el filtrado de opciones de los selects.
 */
import { describe, it, expect } from 'vitest';

interface Empresa {
  empresa_id: number;
  empresa_nombre: string;
  rutas: Ruta[];
}
interface Ruta {
  ruta_id: string;
  driver_name: string | null;
  total_visitas?: number;
}

/**
 * Réplica EXACTA del useMemo `{driverOptions, rutaOptions}` de MapaTab.
 * Si la implementación cambia, este test debe actualizarse a propósito.
 */
function cascadeOptions(
  empresas: Empresa[],
  driverFilter: string,
  rutaFilter: string,
): { driverOptions: string[]; rutaOptions: { ruta_id: string; driver_name: string; empresa_nombre: string; total: number }[] } {
  type RutaOpt = { ruta_id: string; driver_name: string; empresa_nombre: string; total: number };
  const driversSet = new Set<string>();
  const rutasMap: Record<string, RutaOpt> = {};
  empresas.forEach(emp => {
    emp.rutas.forEach(r => {
      // Cascade: si hay ruta elegida, solo dejamos pasar esa ruta.
      if (rutaFilter && r.ruta_id !== rutaFilter) return;
      // Cascade: si hay driver elegido, solo dejamos pasar sus rutas.
      if (driverFilter && r.driver_name !== driverFilter) return;
      if (r.driver_name) driversSet.add(r.driver_name);
      if (r.ruta_id) {
        rutasMap[r.ruta_id] = {
          ruta_id: r.ruta_id,
          driver_name: r.driver_name ?? '—',
          empresa_nombre: emp.empresa_nombre ?? '—',
          total: r.total_visitas ?? 0,
        };
      }
    });
  });
  return {
    driverOptions: Array.from(driversSet).sort(),
    rutaOptions: Object.values(rutasMap).sort((a, b) => a.ruta_id.localeCompare(b.ruta_id)),
  };
}

const SAMPLE: Empresa[] = [
  {
    empresa_id: 1,
    empresa_nombre: 'Transporte 22',
    rutas: [
      { ruta_id: 'R-001', driver_name: 'Ana', total_visitas: 5 },
      { ruta_id: 'R-002', driver_name: 'Beto', total_visitas: 8 },
    ],
  },
  {
    empresa_id: 2,
    empresa_nombre: 'Transporte 25',
    rutas: [
      { ruta_id: 'R-003', driver_name: 'Cira', total_visitas: 12 },
      { ruta_id: 'R-004', driver_name: 'Ana', total_visitas: 3 },
    ],
  },
];

describe('cascade driver↔ruta', () => {
  it('sin filtros: todos los drivers y rutas', () => {
    const { driverOptions, rutaOptions } = cascadeOptions(SAMPLE, '', '');
    expect(driverOptions).toEqual(['Ana', 'Beto', 'Cira']);
    expect(rutaOptions.map(r => r.ruta_id)).toEqual(['R-001', 'R-002', 'R-003', 'R-004']);
  });

  it('filtro por driver Ana: solo sus rutas (R-001 y R-004)', () => {
    const { driverOptions, rutaOptions } = cascadeOptions(SAMPLE, 'Ana', '');
    expect(driverOptions).toEqual(['Ana']);
    expect(rutaOptions.map(r => r.ruta_id)).toEqual(['R-001', 'R-004']);
  });

  it('filtro por ruta R-003: solo Cira en el dropdown driver', () => {
    const { driverOptions, rutaOptions } = cascadeOptions(SAMPLE, '', 'R-003');
    expect(driverOptions).toEqual(['Cira']);
    expect(rutaOptions.map(r => r.ruta_id)).toEqual(['R-003']);
  });

  it('combo driver+ruta consistente: Ana + R-001', () => {
    const { driverOptions, rutaOptions } = cascadeOptions(SAMPLE, 'Ana', 'R-001');
    expect(driverOptions).toEqual(['Ana']);
    expect(rutaOptions.map(r => r.ruta_id)).toEqual(['R-001']);
  });

  it('combo inconsistente: Ana + R-003 (R-003 es de Cira) → vacío', () => {
    const { driverOptions, rutaOptions } = cascadeOptions(SAMPLE, 'Ana', 'R-003');
    expect(driverOptions).toEqual([]);
    expect(rutaOptions).toEqual([]);
  });

  it('driver con dos rutas en empresas distintas: ambas aparecen', () => {
    // Ana tiene R-001 (Transporte 22) y R-004 (Transporte 25)
    const { rutaOptions } = cascadeOptions(SAMPLE, 'Ana', '');
    expect(rutaOptions).toHaveLength(2);
    const empresas = rutaOptions.map(r => r.empresa_nombre);
    expect(empresas).toEqual(expect.arrayContaining(['Transporte 22', 'Transporte 25']));
  });

  it('ruta sin driver_name (null) no contamina driverOptions', () => {
    const data: Empresa[] = [{
      empresa_id: 1,
      empresa_nombre: 'X',
      rutas: [
        { ruta_id: 'R-001', driver_name: null },
        { ruta_id: 'R-002', driver_name: 'Pepe' },
      ],
    }];
    const { driverOptions, rutaOptions } = cascadeOptions(data, '', '');
    expect(driverOptions).toEqual(['Pepe']);
    expect(rutaOptions.map(r => r.ruta_id)).toEqual(['R-001', 'R-002']);
    // R-001 muestra "—" como driver_name en el dropdown
    expect(rutaOptions[0].driver_name).toBe('—');
  });
});
