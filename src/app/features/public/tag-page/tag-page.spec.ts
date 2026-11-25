/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import type { TagResolution } from '../../../models';
import { TagPage } from './tag-page';

const profile = { code: '7K3M-Q9XA-C', pet: { name: 'Paçoca' }, whatsapp_url: 'https://wa.me/5511987654421' };

function render(resolution: TagResolution, codigo = '7K3M-Q9XA-C') {
  TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
  const fixture = TestBed.createComponent(TagPage);
  fixture.componentRef.setInput('resolution', resolution);
  fixture.componentRef.setInput('codigo', codigo);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, has: (id: string) => el.querySelector(`[data-testid="${id}"]`) !== null, byId: (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`) };
}

describe('TagPage (T030, T034)', () => {
  it('assigned sem modo perdido: tela de resgate', () => {
    const { has } = render({ state: 'assigned', profile });
    expect(has('public-rescue-page')).toBe(true);
    expect(has('public-rescue-lost')).toBe(false);
  });

  it('assigned com modo perdido: resgate em modo perdido', () => {
    const { has } = render({
      state: 'assigned',
      profile: { ...profile, lost: { since: '2026-11-19T10:00:00Z' } },
      lostElapsed: { unit: 'days', amount: 2 },
    });
    expect(has('public-rescue-page')).toBe(true);
    expect(has('public-rescue-lost')).toBe(true);
    expect(has('public-rescue-elapsed')).toBe(true);
  });

  it('available: tag não ativada', () => {
    const { has, byId } = render({ state: 'available', code: '7K3M-Q9XA-C' });
    expect(has('public-not-activated')).toBe(true);
    expect(byId('public-not-activated-code')?.textContent).toContain('7K3M-Q9XA-C');
    expect(has('public-rescue-page')).toBe(false);
  });

  it('not_found: tag não encontrada', () => {
    const { has } = render({ state: 'not_found' });
    expect(has('public-not-found')).toBe(true);
    expect(has('public-contingency')).toBe(false);
  });

  it('contingency: "Este pet tem dono" com "Tentar de novo" para o mesmo endereço', () => {
    const { has, byId } = render({ state: 'contingency' }, '7k3m-q9xa-c');
    expect(has('public-contingency')).toBe(true);
    expect(byId('public-notice-title')?.textContent).toContain('Este pet tem dono');
    const retry = byId('public-contingency-retry') as HTMLAnchorElement;
    expect(retry.tagName).toBe('A');
    expect(retry.getAttribute('href')).toBe('/7K3MQ9XAC');
  });

  it('nenhum estado é um erro técnico (sem "erro", "exception", "undefined")', () => {
    const states: TagResolution[] = [
      { state: 'assigned', profile },
      { state: 'available', code: '7K3M-Q9XA-C' },
      { state: 'not_found' },
      { state: 'contingency' },
    ];
    for (const state of states) {
      TestBed.resetTestingModule();
      const { el } = render(state);
      expect(el.textContent?.toLowerCase()).not.toMatch(/erro|exception|undefined|500|stack/);
    }
  });

  it('o <head> é genérico e noindex: nunca o nome do pet', () => {
    render({ state: 'assigned', profile });
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toBe('noindex');
    const og = meta.getTag('property="og:title"')?.content ?? '';
    const description = meta.getTag('name="description"')?.content ?? '';
    expect(og).toContain('Faro');
    for (const text of [og, description, meta.getTag('property="og:description"')?.content ?? '']) {
      expect(text).not.toContain('Paçoca');
    }
    expect(meta.getTag('property="og:image"')).toBeNull();
  });
});

/** Contrato de endurecimento §1 (e T106): a página da tag liga ao app por <a href>, nunca por routerLink. */
describe('features/public/tag-page: links para o app', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });

  it('nenhum arquivo de produção usa routerLink ou RouterLink', () => {
    const dir = join(process.cwd(), 'src/app/features/public/tag-page');
    const sources = files(dir).filter((f) => /\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts'));
    expect(sources.length).toBeGreaterThan(5);
    for (const file of sources) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\brouterLink\s*=|\[routerLink\]|import[^;]*RouterLink/);
    }
  });
});
