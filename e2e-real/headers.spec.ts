import { expect, test } from '@playwright/test';

/**
 * T108 (parte de cabecalhos, contrato security-hardening §3 e §9): cada cabecalho em `/`, em `/auth/login`, em um arquivo estatico
 * e na politica `tag`, servidos pelo `ng serve --configuration e2e` (o dev server aplica `src/security-headers.ts`).
 * Arquivo estatico: o dev server (vite) serve `/favicon.ico` sem esses cabecalhos; a prova e um passo do job `app` contra o servidor
 * construido. O motor da Vercel nao e exercitado aqui: `npm run check:headers` confere o `vercel.json`, e o preview
 * hospedado (T037A da 003) e a prova final.
 */

const HTTPS = { 'x-forwarded-proto': 'https' };

function expectCommon(h: Record<string, string>): void {
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toMatch(/deny|sameorigin/i);
  expect(h['cross-origin-resource-policy']).toBe('same-origin');
  expect(h['content-security-policy']).toContain(`default-src 'self'`);
}

for (const path of ['/', '/auth/login']) {
  test(`cabecalhos da politica app em ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const h = res.headers();
    expectCommon(h);
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=(self)');
    expect(h['permissions-policy']).toContain('geolocation=(self)');
    expect(h['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(h['content-security-policy']).toContain('https://challenges.cloudflare.com');
    // em HTTP (localhost) nao ha HSTS nem upgrade-insecure-requests: quebrariam o Supabase local
    expect(h['strict-transport-security']).toBeUndefined();
    expect(h['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
}

test('com x-forwarded-proto https entram HSTS (sem preload) e upgrade-insecure-requests', async ({ request }) => {
  const res = await request.get('/auth/login', { headers: HTTPS });
  const h = res.headers();
  expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
  expect(h['content-security-policy']).toContain('upgrade-insecure-requests');
});

test('politica tag em /<codigo>: sem terceiro, sem frame-src, referrer no-referrer, camera negada', async ({ request }) => {
  const res = await request.get('/7K3M-Q9XA-C', { headers: HTTPS, failOnStatusCode: false });
  const h = res.headers();
  expectCommon(h);
  expect(h['referrer-policy']).toBe('no-referrer');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['cross-origin-opener-policy']).toBe('same-origin');
  expect(h['content-security-policy']).not.toContain('challenges.cloudflare.com');
  expect(h['content-security-policy']).not.toContain('frame-src');
  expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
});

test('/ nao chama nenhum host de terceiro alem dos permitidos', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http')) hosts.add(u.host);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect([...hosts].filter((h) => h !== 'localhost:4200')).toEqual([]);
});
