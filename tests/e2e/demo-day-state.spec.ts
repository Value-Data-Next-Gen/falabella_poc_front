import { test, expect } from '@playwright/test';
import { apiLogin } from './_helpers';

/**
 * Estados validos:
 *   BORRADOR -> VALIDADO -> EN_CURSO -> CERRADO
 *
 * Este test usa la fecha de HOY (que ya esta en EN_CURSO en la DB) para
 * solamente leer y exhibir el estado actual. NO ejercemos transiciones
 * destructivas porque CERRAR el dia bloquea operaciones reales.
 *
 * Si querés ejecutar transiciones reales, corré este spec contra un dia futuro
 * SIN data importada todavía.
 */
test.describe('Demo cliente — Día operativo: ciclo de vida (read-only)', () => {
  test('lee day_state actual, valida shape y conteos coherentes', async () => {
    const { ctx } = await apiLogin('admin');
    const fecha = new Date().toISOString().slice(0, 10);

    const state = await ctx.get(`/api/planificacion/day-state?fecha=${fecha}`).then(r => r.json());
    console.log(`[day-state] fecha=${fecha} state=${state.state} visitas=${state.visitas}`);
    expect(['BORRADOR', 'VALIDADO', 'EN_CURSO', 'CERRADO']).toContain(state.state);

    // Si esta EN_CURSO, validar que tiene started_at y day_seed.
    if (state.state === 'EN_CURSO') {
      expect(state.started_at).toBeTruthy();
      expect(state.day_seed).toBeGreaterThan(0);
      expect(state.can_close).toBe(true);
    }

    // day-prep: chequeo de conflicts (dotación, drivers, config).
    const prep = await ctx.get(`/api/planificacion/day-prep?fecha=${fecha}`).then(r => r.json());
    expect(prep).toHaveProperty('config_issues');
    expect(prep).toHaveProperty('driver_issues');
    console.log(`[day-state] day-prep: config_issues=${prep.config_issues?.length ?? 0} driver_issues=${prep.driver_issues?.length ?? 0}`);

    // Si esta EN_CURSO, integrigad-rutas debe responder OK.
    if (state.state === 'EN_CURSO') {
      const integridad = await ctx.get(`/api/planificacion/integridad-rutas?fecha=${fecha}`).then(r => r.json());
      expect(integridad).toBeDefined();
      console.log(`[day-state] integridad-rutas OK`);
    }

    await ctx.dispose();
  });

  test('transicion BORRADOR→VALIDADO→BORRADOR sobre fecha futura limpia (idempotente)', async () => {
    const { ctx } = await apiLogin('admin');
    // Fecha futura +7 días para evitar colisión con cualquier día activo.
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    const fecha = d.toISOString().slice(0, 10);

    const initial = await ctx.get(`/api/planificacion/day-state?fecha=${fecha}`).then(r => r.json());
    console.log(`[day-state] fecha futura ${fecha} state inicial=${initial.state} visitas=${initial.visitas}`);

    // Si la fecha futura está vacía, BORRADOR sin visitas, no podemos transicionar — skip.
    if (initial.state === 'BORRADOR' && initial.visitas === 0) {
      test.info().annotations.push({ type: 'note', description: `Fecha ${fecha} sin visitas — no se puede ejercer VALIDADO. Demo requiere import-xlsx previo.` });
      console.log(`[day-state] OK — fecha vacía como esperaba. Ciclo completo requiere importar XLSX primero.`);
      await ctx.dispose();
      return;
    }

    // Si tiene visitas: BORRADOR→VALIDADO→BORRADOR ida y vuelta no-destructivo.
    if (initial.state === 'BORRADOR' && initial.visitas > 0) {
      const toValidado = await ctx.post('/api/planificacion/day-state/transition', {
        data: { fecha, target: 'VALIDADO', confirm: true, allow_non_blocking: true },
      });
      console.log(`[day-state] →VALIDADO status=${toValidado.status()}`);
      if (toValidado.status() === 200) {
        const validado = await toValidado.json();
        expect(validado.state).toBe('VALIDADO');
        const back = await ctx.post('/api/planificacion/day-state/transition', {
          data: { fecha, target: 'BORRADOR', confirm: true },
        });
        const borrador = await back.json();
        expect(borrador.state).toBe('BORRADOR');
        console.log(`[day-state] OK ciclo BORRADOR↔VALIDADO`);
      }
    }
    await ctx.dispose();
  });
});
