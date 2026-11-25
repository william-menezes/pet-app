import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Larguras em que toda tela é conferida (spec 002, FR-046). */
export const WIDTHS = {
  narrow: { width: 320, height: 700 },
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

/** A página não pode rolar na horizontal. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth);
}

/** Roda o axe (WCAG 2.0/2.1 A e AA) e exige zero violações `serious` ou `critical`. */
export async function expectNoSeriousA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    .join('\n');
  expect(serious, report).toEqual([]);
}

/** Valor calculado de uma propriedade CSS (em camelCase, ex.: `backgroundColor`) do primeiro elemento do seletor. */
export async function rgb(page: Page, selector: string, property: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el, prop) => (getComputedStyle(el) as unknown as Record<string, string>)[prop], property);
}
