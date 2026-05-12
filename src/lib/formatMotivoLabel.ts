/**
 * Normaliza el id canónico de un motivo (MAYÚSCULAS, con "/" y abreviaturas)
 * a un label legible Sentence-case para UI.
 *
 * Los IDs en DB son la fuente de verdad (rompe FK lógica con comments y
 * motivo_corrections si se renombran). Esta función solo cambia el display.
 *
 * Reglas:
 *  - Sentence case (primera letra mayúscula, resto minúsculas, preservando
 *    diacríticos).
 *  - "/" rodeado de espacios → " · " (separador limpio).
 *  - Casos puntuales con label explícito (override map).
 */
const OVERRIDES: Record<string, string> = {
  'SIN MORADORES': 'Sin moradores',
  'NO CONOCEN A CLIENTE': 'No conocen al cliente',
  'PROBLEMA DE DIRECCIÓN/ SIN INFORMACIÓN': 'Problema de dirección · sin información',
  'NO DESPACHA A LOCALIDAD': 'No despacha a localidad',
  'FUERA DE COBERTURA/ FRECUENCIA': 'Fuera de cobertura · frecuencia',
  'PROD NO ENTREGADO POR TIEMPO': 'Producto no entregado por tiempo',
  'PRODUCTO NO CARGADO': 'Producto no cargado',
  'CLIENTE RECHAZA': 'Cliente rechaza envío',
  'SINIESTRO EN CALLE': 'Siniestro en calle',
  'PRODUCTO CON PROBLEMAS': 'Producto con problemas',
  'NO CUMPLE CONDICIONES RETIRO': 'No cumple condiciones de retiro',
  'PRODUCTO ROBADO': 'Producto robado',
  'RIESGO FRAUDE': 'Riesgo de fraude',
  'DETENCION URGENTE': 'Detención urgente',
};

export function formatMotivoLabel(id: string | null | undefined): string {
  if (!id) return '—';
  const raw = id.trim();
  if (!raw) return '—';
  if (OVERRIDES[raw]) return OVERRIDES[raw];
  // Fallback: limpiamos slashes raros y aplicamos Sentence case.
  const cleaned = raw
    .replace(/\s*\/\s*$/g, '')      // slash final
    .replace(/\s*\/\s*/g, ' · ')    // slash interno
    .replace(/\s+/g, ' ')
    .trim();
  const lower = cleaned.toLocaleLowerCase('es-CL');
  return lower.charAt(0).toLocaleUpperCase('es-CL') + lower.slice(1);
}
