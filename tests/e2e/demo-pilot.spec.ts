import { test, expect } from '@playwright/test';
import { apiLogin, todayISO } from './_helpers';

test.describe('Demo cliente — Flujo Piloto completo', () => {
  test('setup → status → advance clock → simulate event → audit log', async () => {
    const { ctx } = await apiLogin('admin');
    const fecha = todayISO();

    // 0) Activar dry_run + reset clock a estado limpio (puede haber sobrado de un run anterior).
    await ctx.post('/api/notifications/toggle?dry_run=true&enabled=true');
    await ctx.post('/api/admin/pilot/clock', { data: { fecha, action: 'reset' } });

    // 1) Listar drivers disponibles (endpoint admin que trae phone_e164/notify_whatsapp).
    const drivers: any[] = await ctx.get('/api/admin/drivers').then(r => r.json());
    const activeWithPhone = drivers.filter(d => d.active && d.phone_e164 && d.notify_whatsapp);
    const eligible = activeWithPhone.length >= 2 ? activeWithPhone : drivers.filter(d => d.active);
    if (eligible.length < 2) {
      test.skip(true, `Solo ${eligible.length} drivers activos — necesito >=2 para demo`);
      return;
    }
    const chosen = eligible.slice(0, 2).map(d => d.driver_id);
    console.log(`[pilot] phone+notify aptos: ${activeWithPhone.length}/${drivers.length}; eligiendo: ${chosen.join(',')}`);
    console.log(`[pilot] drivers seleccionados: ${chosen.join(', ')}`);

    // 2) Verificar clock inicial.
    const clock0 = await ctx.get(`/api/admin/pilot/clock?fecha=${fecha}`).then(r => r.json());
    expect(clock0.mode).toBe('auto');
    expect(clock0.offset_min).toBe(0);

    // 3) Setup piloto (sobrescribe data del dia para los drivers elegidos).
    const setup = await ctx.post('/api/admin/pilot/setup', {
      data: {
        fecha,
        driver_ids: chosen,
        regiones: ['RM'],
        visitas_por_driver: 2,
        horario_inicio: '09:00',
        horario_fin: '18:00',
        auto_start_day: true,
      },
    });
    expect(setup.status()).toBeLessThan(500);
    const setupBody = await setup.json();
    console.log(`[pilot] setup: created=${setupBody.created} day_state=${setupBody.day_state}`);
    expect(setupBody.created).toBeGreaterThan(0);
    expect(setupBody.day_state).toBe('EN_CURSO');

    // 4) Status: debe reflejar las visitas pending recien creadas.
    const status1 = await ctx.get(`/api/admin/pilot/status?fecha=${fecha}`).then(r => r.json());
    expect(status1.totals.pending).toBeGreaterThan(0);
    console.log(`[pilot] status post-setup: pending=${status1.totals.pending}`);

    // 5) Positions: drivers aparecen con coords (lat/lng != null).
    const positions: any[] = await ctx.get(`/api/operacion/driver-positions?fecha=${fecha}`).then(r => r.json());
    const myDrivers = positions.filter(p => chosen.includes(p.driver_id));
    expect(myDrivers.length).toBeGreaterThan(0);
    for (const p of myDrivers) {
      expect(p.lat).toBeGreaterThan(-90);
      expect(p.lng).toBeLessThan(0);
    }

    // 6) Avanzar sim_clock +60min (fuerza varias ETAs a quedar vencidas).
    const advance = await ctx.post('/api/admin/pilot/clock', {
      data: { fecha, action: 'advance', minutes: 60 },
    });
    expect(advance.status()).toBe(200);
    const clockAfter = await advance.json();
    expect(clockAfter.offset_min).toBeGreaterThanOrEqual(60);
    expect(clockAfter.mode).toBe('manual');

    // 7) Simulate-event delay sobre la 1ra visita pending → dispatch_eta_breach.
    const firstPending = myDrivers.find(p => p.next_visit_id != null);
    expect(firstPending, 'esperaba al menos un next_visit_id').toBeTruthy();
    const tid = String(firstPending!.next_visit_id);

    const sim = await ctx.post('/api/admin/pilot/simulate-event', {
      data: { tracking_id: tid, event: 'delay' },
    });
    expect(sim.status()).toBeLessThan(500);
    const simBody = await sim.json();
    console.log(`[pilot] simulate-event delay TID=${tid}: ${JSON.stringify(simBody)}`);
    expect(simBody.detail || '').toMatch(/Alerta WhatsApp/i);

    // 8) El log de notificaciones registra el envío para ese TID.
    await expect.poll(async () => {
      const r: any[] = await ctx.get('/api/notifications/log?limit=200').then(x => x.json());
      return r.some(row => String(row.tracking_id ?? row.tid ?? '') === tid && /eta_breach/.test(String(row.triggered_by ?? '')));
    }, { timeout: 8_000 }).toBe(true);

    // 9) Simulate-event complete sobre otra visita pending.
    const secondPending = myDrivers.find(p => p.next_visit_id != null && String(p.next_visit_id) !== tid);
    if (secondPending) {
      const tid2 = String(secondPending.next_visit_id);
      const sim2 = await ctx.post('/api/admin/pilot/simulate-event', {
        data: { tracking_id: tid2, event: 'complete' },
      });
      expect(sim2.status()).toBeLessThan(500);
      console.log(`[pilot] simulate-event complete TID=${tid2} OK`);
    }

    // 10) Reset clock para limpieza.
    await ctx.post('/api/admin/pilot/clock', { data: { fecha, action: 'reset' } });

    console.log('[pilot] OK — flujo completo: setup → advance → simulate → audit log');
    await ctx.dispose();
  });
});
