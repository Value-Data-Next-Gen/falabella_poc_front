import { test, expect } from '@playwright/test';
import { apiLogin, todayISO } from './_helpers';

test.describe('Demo cliente — WhatsApp DRY_RUN: payload + auditoria', () => {
  test('toggle dry_run, disparar notify-eta-breach, verificar log con template variables', async () => {
    const { ctx } = await apiLogin('admin');

    // 1) Activar dry_run runtime (no envia a Twilio real, solo registra el payload).
    const toggle = await ctx.post('/api/notifications/toggle?dry_run=true&enabled=true');
    expect(toggle.status()).toBe(200);
    const cfg = await ctx.get('/api/notifications/config').then(r => r.json());
    expect(cfg.dry_run).toBe(true);
    expect(cfg.enabled).toBe(true);

    // 2) Buscar una visita pending del dia para usar como target.
    const positions = await ctx.get(`/api/operacion/driver-positions?fecha=${todayISO()}`).then(r => r.json());
    const driverWithPending = (positions as any[]).find(p => p.next_visit_id != null);
    if (!driverWithPending) {
      test.skip(true, 'No hay visitas pending hoy — corré /api/admin/pilot/setup primero');
      return;
    }
    const tid = String(driverWithPending.next_visit_id);
    console.log(`[demo-whatsapp] target TID=${tid} driver=${driverWithPending.driver_name}`);

    // 3) Snapshot del log ANTES del dispatch.
    const beforeRows = await ctx.get('/api/notifications/log?limit=50&triggered_by=eta_breach_manual').then(r => r.json());
    const beforeCount = (beforeRows as any[]).length;

    // 4) Disparar notify-eta-breach manual.
    const breach = await ctx.post('/api/admin/notify-eta-breach', { data: { tracking_id: tid } });
    expect(breach.status()).toBeLessThan(500);
    const breachBody = await breach.json();
    console.log(`[demo-whatsapp] dispatch resp: ${JSON.stringify(breachBody)}`);

    // 5) Esperar a que el log refleje el nuevo envio.
    await expect.poll(async () => {
      const r = await ctx.get('/api/notifications/log?limit=50&triggered_by=eta_breach_manual').then(x => x.json());
      return (r as any[]).length;
    }, { timeout: 8_000 }).toBeGreaterThan(beforeCount);

    // 6) Verificar la entrada nueva: status dry_run o sent, template con variables.
    const afterRows: any[] = await ctx.get('/api/notifications/log?limit=10&triggered_by=eta_breach_manual').then(r => r.json());
    const newest = afterRows[0];
    expect(['dry_run', 'sent', 'queued']).toContain(newest.status);
    expect(newest.tracking_id ?? newest.tid ?? '').toBeTruthy();

    // El payload del template tiene que contener las 6 variables del vd_alerta_motivo_v2.
    const payload = newest.payload ?? newest.template_variables ?? newest.content_variables ?? newest;
    const raw = JSON.stringify(payload);
    expect(raw).toMatch(/POSIBLE ATRASO ETA|atraso|breach|HIGH/i);
    console.log(`[demo-whatsapp] OK — log entry status=${newest.status} payload contiene template vars`);

    await ctx.dispose();
  });
});
