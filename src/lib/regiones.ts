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
