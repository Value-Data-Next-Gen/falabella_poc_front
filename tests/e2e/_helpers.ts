import { APIRequestContext, Page, expect, request } from '@playwright/test';

export const USERS = {
  admin: { email: 'admin@falabella.cl', password: 'admin123', role: 'falabella_admin', empresa_id: null as number | null },
  ops: { email: 'ops@falabella.cl', password: 'ops123', role: 'falabella_ops', empresa_id: null as number | null },
  transport22: { email: 'transporte22@demo.cl', password: 'demo123', role: 'transport_manager', empresa_id: 22 },
};

export const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8001';

export type UserKey = keyof typeof USERS;

export async function uiLogin(page: Page, who: UserKey = 'admin') {
  const u = USERS[who];
  await page.addInitScript(() => {
    try { localStorage.setItem('fpoc.tour.completed.v1', '1'); } catch {}
  });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  const loginResp = page.waitForResponse(
    r => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: /entrar/i }).click();
  const r = await loginResp;
  if (r.status() !== 200) throw new Error(`Login failed: HTTP ${r.status()}`);
  await expect(page.locator('[data-tour-id^="sidebar-"]').first()).toBeVisible({ timeout: 15_000 });
}

export async function apiLogin(who: UserKey = 'admin'): Promise<{ ctx: APIRequestContext; token: string; user: any }> {
  const u = USERS[who];
  const ctx = await request.newContext({ baseURL: BACKEND });
  const r = await ctx.post('/api/auth/login', { data: { email: u.email, password: u.password } });
  if (r.status() !== 200) throw new Error(`apiLogin ${who}: HTTP ${r.status()}`);
  const body = await r.json();
  await ctx.dispose();
  const authed = await request.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { Authorization: `Bearer ${body.access_token}` },
  });
  return { ctx: authed, token: body.access_token, user: body.user };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
