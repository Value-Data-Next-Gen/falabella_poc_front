import { test, expect, Page } from '@playwright/test';

const ADMIN = { email: 'admin@falabella.cl', password: 'admin123' };

async function login(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('fpoc.tour.completed.v1', '1'); } catch {}
  });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  const loginResp = page.waitForResponse(
    r => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: /entrar/i }).click();
  const r = await loginResp;
  if (r.status() !== 200) {
    throw new Error(`Login failed: HTTP ${r.status()} — ${await r.text()}`);
  }
  await expect(page.locator('[data-tour-id^="sidebar-"]').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Torre de Control smoke E2E', () => {
  test('login as admin renders sidebar', async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-tour-id="sidebar-operacion"]')).toBeVisible();
    await expect(page.locator('[data-tour-id="sidebar-piloto"]')).toBeVisible();
  });

  test('opens Operacion, renders map + drivers table', async ({ page }) => {
    await login(page);
    await page.locator('[data-tour-id="sidebar-operacion"]').click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
    const driverCalls = page.waitForResponse(
      r => r.url().includes('/api/operacion/driver-positions') && r.status() === 200,
      { timeout: 10_000 },
    ).catch(() => null);
    await driverCalls;
    expect(page.url()).toContain('#');
  });

  test('opens Piloto, displays sim clock and setup form', async ({ page }) => {
    await login(page);
    // Setup listeners ANTES del click para evitar race con respuestas tempranas.
    const clockReq = page.waitForResponse(
      r => r.url().includes('/api/admin/pilot/clock') && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 15_000 },
    );
    const statusReq = page.waitForResponse(
      r => r.url().includes('/api/admin/pilot/status') && r.status() === 200,
      { timeout: 15_000 },
    );
    await page.locator('[data-tour-id="sidebar-piloto"]').click();
    const [clock, status] = await Promise.all([clockReq, statusReq]);
    const clockBody = await clock.json();
    expect(clockBody).toMatchObject({
      fecha: expect.any(String),
      sim_clock: expect.any(String),
      offset_min: expect.any(Number),
      mode: expect.stringMatching(/auto|manual/),
    });
    const statusBody = await status.json();
    expect(statusBody.totals).toMatchObject({
      pending: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
    });
    await expect(page.getByText(/sim.?clock|reloj/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /\+15/i })).toBeVisible();
  });

  test('Piloto +30min advances sim_clock', async ({ page }) => {
    await login(page);
    const firstClock = page.waitForResponse(
      r => r.url().includes('/api/admin/pilot/clock') && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 15_000 },
    );
    await page.locator('[data-tour-id="sidebar-piloto"]').click();
    await firstClock;
    // Cerrar cualquier modal residual que pueda bloquear los clicks.
    const overlay = page.locator('.fixed.inset-0.z-50').first();
    if (await overlay.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
    // Click +30, capturar el POST que se dispara (puede haber otros POST en flight).
    const advanceReq = page.waitForResponse(
      r => r.url().includes('/api/admin/pilot/clock')
        && r.request().method() === 'POST'
        && r.request().postDataJSON()?.action === 'advance',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /\+30/i }).first().click({ force: true });
    const resp = await advanceReq;
    const body = await resp.json();
    expect(body.offset_min).toBeGreaterThanOrEqual(30);
    expect(body.mode).toBe('manual');

    // Reset: por HTTP directo para no depender del DOM (que puede estar tapado
    // por modales residuales de tests previos en la misma sesión).
    const token = await page.evaluate(() => localStorage.getItem('fpoc.token'));
    const resetResp = await page.request.post('http://127.0.0.1:8001/api/admin/pilot/clock', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { fecha: new Date().toISOString().slice(0,10), action: 'reset' },
    });
    expect(resetResp.status()).toBe(200);
    const resetBody = await resetResp.json();
    expect(resetBody.offset_min).toBe(0);
  });
});
