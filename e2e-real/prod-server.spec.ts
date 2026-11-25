import { gzipSync } from 'node:zlib';

import { expect, test } from '@playwright/test';

import seed from '../e2e/fixtures/seed-codes.json';
import { expectNoSeriousA11y } from '../e2e/support/ui';
import { tid } from './support/flows';
import { stack } from './support/stack';
import { SSR_KEY } from './support/tags';

/**
 * T037 e T092 (parte de build): a rota publica no SERVIDOR DE PRODUCAO CONSTRUIDO (`dist/faro/server/server.mjs`), nao no
 * `ng serve`. O job `e2e` do CI constroi e sobe duas instancias:
 *   - porta 4300: Edge Functions do stack local (resgate de verdade);
 *   - porta 4301: URL das funcoes apontando para uma porta morta (a pagina nunca pode mostrar erro tecnico).
 * Sem `E2E_PROD_URL` (maquina de desenvolvimento) os testes pulam.
 */
const PROD = process.env['E2E_PROD_URL'];
const DEAD = process.env['E2E_PROD_DEAD_URL'];
test.skip(!PROD || !DEAD, 'E2E_PROD_URL e E2E_PROD_DEAD_URL (servidor de producao construido) nao definidos');

test.describe('rota publica no servidor de producao', () => {
  test.use({ baseURL: PROD, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-real-ip': '203.0.113.150' } });

  test('orcamento: TTFB, LCP e JS gzip da pagina de resgate', async ({ page }) => {
    // o pacote do app aponta para o Supabase hospedado no ambiente de producao: nada daqui o chama
    await page.route(/supabase\.co/, (route) => route.abort());
    const scripts = new Map<string, number>();
    const pending: Promise<void>[] = [];
    page.on('response', (res) => {
      const u = new URL(res.url());
      if (u.pathname.endsWith('.js') && u.host === new URL(PROD!).host) {
        pending.push(res.body().then((b) => void scripts.set(u.pathname, gzipSync(b).length), () => undefined));
      }
    });
    const ttfbs: number[] = [];
    let lcp = 0;
    for (let i = 0; i < 3; i++) {
      await page.goto(`/${seed.assigned}`, { waitUntil: 'networkidle' });
      await expect(page.locator(tid('public-rescue-title'))).toBeVisible();
      ttfbs.push(await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).responseStart));
      lcp = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            new PerformanceObserver((list) => {
              const e = list.getEntries();
              resolve(e[e.length - 1].startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => resolve(-1), 3000);
          }),
      );
    }
    await Promise.all(pending);
    ttfbs.sort((a, b) => a - b);
    const kb = [...scripts.values()].reduce((a, b) => a + b, 0) / 1024;
    test.info().annotations.push({ type: 'medido', description: `TTFB mediana ${ttfbs[1].toFixed(0)} ms; LCP ${lcp.toFixed(0)} ms; JS ${kb.toFixed(1)} kB gzip em ${scripts.size} arquivos` });
    expect(ttfbs[1], `TTFB ${ttfbs.join('/')} ms`).toBeLessThanOrEqual(600);
    expect(lcp, 'LCP em ms').toBeGreaterThan(0);
    expect(lcp, 'LCP').toBeLessThanOrEqual(2500);
  });

  // DEF-003-02: o JS da rota publica passa de 100 kB gzip (o orcamento de T037). Mais de 130 kB hoje: so o Angular e ~95 kB.
  test.fail('DEF-003-02: JS da rota publica <= 100 kB gzip', async ({ page }) => {
    await page.route(/supabase\.co/, (route) => route.abort());
    const sizes = new Map<string, number>();
    const pending: Promise<void>[] = [];
    page.on('response', (res) => {
      const u = new URL(res.url());
      if (u.pathname.endsWith('.js') && u.host === new URL(PROD!).host) {
        pending.push(res.body().then((b) => void sizes.set(u.pathname, gzipSync(b).length), () => undefined));
      }
    });
    await page.goto(`/${seed.assigned}`, { waitUntil: 'networkidle' });
    await expect(page.locator(tid('public-rescue-title'))).toBeVisible();
    await Promise.all(pending);
    const kb = [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
    test.info().annotations.push({ type: 'medido', description: `JS ${kb.toFixed(1)} kB gzip em ${sizes.size} arquivos` });
    expect(kb).toBeLessThanOrEqual(100);
  });

  test('os quatro estados no build de producao: axe, sem erro tecnico, sem segredo, sem chunk do app autenticado', async ({ page, request }) => {
    await page.route(/supabase\.co/, (route) => route.abort());
    for (const code of [seed.assigned, seed.available, seed.blocked]) {
      await page.goto(`/${code}`);
      await expect(page.locator('main, [data-testid^="public-"]').first()).toBeVisible();
      await expectNoSeriousA11y(page);
      const text = (await page.locator('body').innerText()).toLowerCase();
      expect(text).not.toMatch(/exception|undefined|stack trace|internal server/);
    }
    const html = await (await request.get(`/${seed.assigned}`)).text();
    for (const forbidden of [SSR_KEY, stack.serviceKey, 'service_role', 'FARO_SSR_KEY', 'IP_HASH_SECRET', 'activation_pin_hash']) {
      expect(html, forbidden).not.toContain(forbidden);
    }
    // os scripts que a pagina carrega nao incluem os pedacos do app autenticado
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    for (const src of srcs) {
      const body = await (await request.get(src)).text();
      expect(body, src).not.toMatch(/admin-create-batch|activation_pin|my_dashboard|release_tag|admin_list_/);
    }
    const res = await request.get(`/${seed.assigned}`);
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(res.headers()['x-robots-tag']).toBe('noindex');
    expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
  });
});

test.describe('funcoes fora do ar: a pagina da tag nunca mostra erro tecnico', () => {
  test.use({ baseURL: DEAD, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-real-ip': '203.0.113.151' } });

  for (const code of [seed.assigned, seed.available, seed.blocked, '000000000', 'ZZZZZZZZZ']) {
    test(`contingencia para ${code === seed.assigned ? 'tag vinculada' : code}`, async ({ page, request }) => {
      await page.route(/supabase\.co/, (route) => route.abort());
      const res = await request.get(`/${code}`);
      expect(res.status(), 'nunca 5xx').toBe(200);
      expect(res.headers()['cache-control']).toBe('no-store');
      await page.goto(`/${code}`);
      await expect(page.locator('body')).not.toContainText(/erro|exception|undefined|stack|500|econnrefused|fetch failed/i);
      await expectNoSeriousA11y(page);
    });
  }

  test('com as funcoes fora do ar existe a saida "Tentar de novo"', async ({ page }) => {
    await page.route(/supabase\.co/, (route) => route.abort());
    await page.goto(`/${seed.assigned}`);
    await expect(page.locator(tid('public-contingency-retry'))).toBeVisible();
    await expect(page.locator(tid('public-contingency-retry'))).toHaveAttribute('href', `/${seed.assigned}`);
  });
});
