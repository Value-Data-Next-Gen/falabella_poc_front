/**
 * Las 16 regiones administrativas de Chile en orden norte→sur.
 * Único origen de verdad para todos los <Select> de región del proyecto.
 *
 * "Metropolitana" cubre la RM (alias "RM" sigue aceptado en filtros de
 * backend pero el label visible debe ser "Metropolitana").
 */
export const REGIONES_CL = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
] as const;

export type RegionCL = typeof REGIONES_CL[number];

/**
 * Bounding boxes aproximados por región para validar que una visita con lat/lon
 * pertenezca a su región declarada. Margen ~0.5° para zonas costeras y
 * fronteras administrativas.
 *
 * Usados por OperationsMap para descartar stops "fantasma" cuyo lat/lon NO
 * coincide con la región del plan-diario (causa principal de las líneas que
 * cruzan el país en el mapa).
 */
export const REGION_BBOX: Record<string, { latMin: number; latMax: number; lonMin: number; lonMax: number }> = {
  'Arica y Parinacota': { latMin: -19.5, latMax: -17.4, lonMin: -71.5, lonMax: -68.4 },
  'Tarapacá':           { latMin: -22.7, latMax: -19.0, lonMin: -71.5, lonMax: -68.0 },
  'Antofagasta':        { latMin: -26.5, latMax: -21.0, lonMin: -71.5, lonMax: -67.0 },
  'Atacama':            { latMin: -29.7, latMax: -25.0, lonMin: -71.7, lonMax: -68.0 },
  'Coquimbo':           { latMin: -32.7, latMax: -29.0, lonMin: -72.0, lonMax: -69.5 },
  'Valparaíso':         { latMin: -34.0, latMax: -32.0, lonMin: -73.0, lonMax: -70.0 },
  'Metropolitana':      { latMin: -34.5, latMax: -32.8, lonMin: -71.5, lonMax: -69.7 },
  "O'Higgins":          { latMin: -35.2, latMax: -33.7, lonMin: -72.0, lonMax: -70.0 },
  'Maule':              { latMin: -36.6, latMax: -34.6, lonMin: -73.0, lonMax: -70.0 },
  'Ñuble':              { latMin: -37.5, latMax: -36.0, lonMin: -72.7, lonMax: -71.0 },
  'Biobío':             { latMin: -38.6, latMax: -36.5, lonMin: -73.7, lonMax: -71.0 },
  'La Araucanía':       { latMin: -39.7, latMax: -37.5, lonMin: -73.5, lonMax: -70.8 },
  'Los Ríos':           { latMin: -40.7, latMax: -39.0, lonMin: -73.6, lonMax: -71.5 },
  'Los Lagos':          { latMin: -44.2, latMax: -40.0, lonMin: -74.7, lonMax: -71.0 },
  'Aysén':              { latMin: -49.0, latMax: -43.5, lonMin: -75.5, lonMax: -71.0 },
  'Magallanes':         { latMin: -56.7, latMax: -48.0, lonMin: -76.0, lonMax: -66.0 },
};

// Aliases comunes: el backend usa "RM" pero el dict canónico es
// "Metropolitana". Sin esto, el filtro de región del mapa retornaba siempre
// true (bbox undefined → fallthrough → permitido). Detectado por test
// unitario __tests__/smoke.test.ts.
const REGION_ALIAS: Record<string, string> = {
  'RM': 'Metropolitana',
  'Araucanía': 'La Araucanía',
};

/** Devuelve true si el lat/lon cae dentro del bbox declarado de la región. */
export function isLatLonInRegion(lat: number, lon: number, region: string | null | undefined): boolean {
  if (!region) return true; // sin región declarada → no podemos validar
  const canon = REGION_ALIAS[region] ?? region;
  const bbox = REGION_BBOX[canon];
  if (!bbox) return true; // región desconocida → permitimos
  return lat >= bbox.latMin && lat <= bbox.latMax && lon >= bbox.lonMin && lon <= bbox.lonMax;
}

/** Color hash determinístico por vehicle_id para distinguir rutas en el mapa.
 * Devuelve [r,g,b,a] en formato deck.gl. Usa la paleta tab10 sin gris/marrón. */
const ROUTE_COLORS: [number, number, number][] = [
  [31, 119, 180],   // azul
  [255, 127, 14],   // naranja
  [44, 160, 44],    // verde
  [214, 39, 40],    // rojo
  [148, 103, 189],  // violeta
  [227, 119, 194],  // rosa
  [188, 189, 34],   // amarillo verdoso
  [23, 190, 207],   // cyan
  [255, 187, 120],  // naranja claro
  [152, 223, 138],  // verde claro
  [255, 152, 150],  // rojo claro
  [197, 176, 213],  // lavanda
];

export function routeColorByVehicle(vehicle_id: number, alpha: number = 200): [number, number, number, number] {
  const idx = ((vehicle_id % ROUTE_COLORS.length) + ROUTE_COLORS.length) % ROUTE_COLORS.length;
  const [r, g, b] = ROUTE_COLORS[idx];
  return [r, g, b, alpha];
}
