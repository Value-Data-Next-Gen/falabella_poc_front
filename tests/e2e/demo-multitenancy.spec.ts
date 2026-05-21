import { test, expect } from '@playwright/test';
import { apiLogin, uiLogin, USERS } from './_helpers';

test.describe('Demo cliente — Multi-tenancy: 2 sesiones', () => {
  test('admin ve todas las empresas; transport_manager solo la suya', async () => {
    const admin = await apiLogin('admin');
    const tm = await apiLogin('transport22');

    expect(admin.user.role).toBe('falabella_admin');
    expect(tm.user.role).toBe('transport_manager');
    expect(tm.user.empresa_id).toBe(22);

    // 1) Drivers: admin ve todos, manager solo los de su empresa.
    const adminDrivers = await admin.ctx.get('/api/drivers').then(r => r.json());
    const tmDrivers = await tm.ctx.get('/api/drivers').then(r => r.json());
    const adminEmpresas = new Set((adminDrivers as any[]).map(d => d.empresa_id).filter(Boolean));
    const tmEmpresas = new Set((tmDrivers as any[]).map(d => d.empresa_id).filter(Boolean));

    console.log(`[multitenancy] admin drivers=${adminDrivers.length} (empresas=${adminEmpresas.size})`);
    console.log(`[multitenancy] tm drivers=${tmDrivers.length} (empresas=${tmEmpresas.size})`);

    expect(adminDrivers.length).toBeGreaterThanOrEqual(tmDrivers.length);
    expect(adminEmpresas.size).toBeGreaterThanOrEqual(1);
    expect(tmEmpresas.size).toBeLessThanOrEqual(1);
    if (tmEmpresas.size === 1) {
      expect([...tmEmpresas][0]).toBe(22);
    }

    // 2) Pilot endpoints: transport_manager NO puede setup/clock (admin/ops only).
    const setupBlocked = await tm.ctx.post('/api/admin/pilot/clock', {
      data: { fecha: new Date().toISOString().slice(0,10), action: 'advance', minutes: 5 },
    });
    expect([401, 403]).toContain(setupBlocked.status());

    // 3) Admin sí puede.
    const setupOk = await admin.ctx.get(`/api/admin/pilot/clock?fecha=${new Date().toISOString().slice(0,10)}`);
    expect(setupOk.status()).toBe(200);

    await admin.ctx.dispose();
    await tm.ctx.dispose();
  });

  test('UI: sidebar de Piloto solo visible para falabella roles', async ({ browser }) => {
    const ctxFala = await browser.newContext();
    const pageFala = await ctxFala.newPage();
    await uiLogin(pageFala, 'admin');
    await expect(pageFala.locator('[data-tour-id="sidebar-piloto"]')).toBeVisible();

    const ctxTm = await browser.newContext();
    const pageTm = await ctxTm.newPage();
    await uiLogin(pageTm, 'transport22');
    await expect(pageTm.locator('[data-tour-id="sidebar-piloto"]')).toHaveCount(0);
    // Pero sí ve Operación y otros módulos compartidos.
    await expect(pageTm.locator('[data-tour-id="sidebar-operacion"]')).toBeVisible();

    await ctxFala.close();
    await ctxTm.close();
  });
});
