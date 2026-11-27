import { expect, test } from '@playwright/test';

/**
 * T034 (spec 003): cabeçalhos e `<head>` da rota da tag, sem backend (o servidor de desenvolvimento não tem
 * as variáveis de ambiente do SSR: a página cai na contingência, e é isso que se confere aqui). Nenhuma
 * chamada ao Supabase sai: o servidor só fala com a Edge Function quando `FARO_SSR_KEY` existe.
 *
 * Os casos de resgate com dados, as comparações de HTML entre inexistente, bloqueado e anulado e o
 * comportamento sem JavaScript são do QA (T035).
 */
const CODE = '7K3M-Q9XA-C';

test.describe('rota da tag: cabeçalhos e head', () => {
  test('responde 200 com no-store, noindex e a política "tag" de cabeçalhos', async ({ request }) => {
    const response = await request.get(`/${CODE}`);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['x-robots-tag']).toBe('noindex');
    expect(headers['referrer-policy']).toBe('no-referrer');
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('challenges.cloudflare.com');
  });

  test('o <head> é genérico: título, descrição e Open Graph sem nome de pet, e noindex', async ({ request }) => {
    const html = await (await request.get(`/${CODE}`)).text();
    expect(html).toContain('<title>Faro · tag de identificação</title>');
    expect(html).toMatch(/<meta[^>]+name="robots"[^>]+content="noindex"/);
    expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="Faro · tag de identificação"/);
    expect(html).not.toMatch(/og:image/);
  });

  test('o endereço com espaço codificado e o código em minúsculas casam com a mesma página', async ({ request }) => {
    for (const path of ['/7k3m%20q9xa%20c', '/7k3m-q9xa-c', '/7K3MQ9XAC']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cache-control'], path).toBe('no-store');
      expect(await response.text(), path).toContain('<title>Faro · tag de identificação</title>');
    }
  });

  test('um caminho que não é código nem rota cai na página "não encontrada" do app', async ({ request }) => {
    const response = await request.get('/qualquer-coisa');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Não encontramos esta página.');
  });

  test('a página da tag nunca mostra erro técnico, mesmo sem as variáveis do servidor', async ({ page }) => {
    await page.goto(`/${CODE}`);
    await expect(page.getByTestId('public-contingency')).toBeVisible();
    await expect(page.getByTestId('public-contingency-retry')).toHaveAttribute('href', '/7K3MQ9XAC');
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toMatch(/erro|exception|undefined|stack/);
  });
});
