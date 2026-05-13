/**
 * Test de la curva de backoff exponencial del polling de Operación.
 * El brief CR-010 Tarea 6 especifica: 10s → 20s → 40s → 80s (max).
 * Si alguien cambia la curva, este test la documenta.
 */
import { describe, it, expect } from 'vitest';
import { operacionBackoffMs } from '../src/hooks/useLiveOperationData';

describe('operacionBackoffMs', () => {
  it('intento 1: 10s', () => {
    expect(operacionBackoffMs(1)).toBe(10_000);
  });

  it('intento 2: 20s', () => {
    expect(operacionBackoffMs(2)).toBe(20_000);
  });

  it('intento 3: 40s', () => {
    expect(operacionBackoffMs(3)).toBe(40_000);
  });

  it('intento 4: 80s', () => {
    expect(operacionBackoffMs(4)).toBe(80_000);
  });

  it('intento 5+: se capa en 80s (no crece más)', () => {
    expect(operacionBackoffMs(5)).toBe(80_000);
    expect(operacionBackoffMs(10)).toBe(80_000);
    expect(operacionBackoffMs(100)).toBe(80_000);
  });

  it('intento 0 o negativo: usa la base 10s (no crashea)', () => {
    expect(operacionBackoffMs(0)).toBe(10_000);
    expect(operacionBackoffMs(-1)).toBe(10_000);
  });
});
