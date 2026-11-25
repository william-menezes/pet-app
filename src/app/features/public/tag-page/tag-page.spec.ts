/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ScanClient } from '../../../core/tags/scan-client.service';
import type { ScanResponse, TagResolution } from '../../../models';
import { TagPage } from './tag-page';

const profile = { code: '7K3M-Q9XA-C', pet: { name: 'Paçoca' }, whatsapp_url: 'https://wa.me/5511987654421' };

interface FakeScans {
  registerScan: ReturnType<typeof vi.fn<(code: string) => Promise<ScanResponse>>>;
  sendLocation: ReturnType<typeof vi.fn<(token: string, position: unknown) => Promise<boolean>>>;
}

function render(resolution: TagResolution, codigo = '7K3M-Q9XA-C', scan: ScanResponse = { owner: false }) {
  const scans: FakeScans = {
    registerScan: vi.fn<(code: string) => Promise<ScanResponse>>().mockResolvedValue(scan),
    sendLocation: vi.fn<(token: string, position: unknown) => Promise<boolean>>().mockResolvedValue(true),
  };
  TestBed.configureTestingModule({
    providers: [provideIcons(faroIcons), { provide: ScanClient, useValue: scans }],
  });
  const fixture = TestBed.createComponent(TagPage);
  fixture.componentRef.setInput('resolution', resolution);
  fixture.componentRef.setInput('codigo', codigo);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    scans,
    el,
    has: (id: string) => el.querySelector(`[data-testid="${id}"]`) !== null,
    byId: (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`),
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
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

describe('TagPage: scan, visão do dono e localização (T048, T054)', () => {
  const assigned: TagResolution = { state: 'assigned', profile: { ...profile, tutor_first_name: 'Ana' } };

  it('depois da hidratação chama /api/scan com o código canônico', async () => {
    const { scans, settle } = render(assigned, '7k3m-q9xa-c');
    await settle();
    expect(scans.registerScan).toHaveBeenCalledWith('7K3MQ9XAC');
  });

  it('não chama /api/scan para código com dígito errado nem para contingência', async () => {
    const bad = render({ state: 'not_found' }, '7K3MQ9XAD');
    await bad.settle();
    expect(bad.scans.registerScan).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const down = render({ state: 'contingency' });
    await down.settle();
    expect(down.scans.registerScan).not.toHaveBeenCalled();
  });

  it('chama /api/scan também em "não encontrada" e "não ativada" (a fila do admin precisa do scan)', async () => {
    const notFound = render({ state: 'not_found' });
    await notFound.settle();
    expect(notFound.scans.registerScan).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    const available = render({ state: 'available', code: '7K3M-Q9XA-C' });
    await available.settle();
    expect(available.scans.registerScan).toHaveBeenCalledTimes(1);
  });

  it('owner: true mostra a visão do dono (faixa, botões desativados)', async () => {
    const { byId, settle, has } = render(assigned, '7K3M-Q9XA-C', { owner: true });
    expect(has('public-owner-banner')).toBe(false);
    await settle();
    expect(has('public-owner-banner')).toBe(true);
    expect((byId('public-rescue-whatsapp') as HTMLButtonElement).disabled).toBe(true);
  });

  it('owner: false não mostra a visão do dono', async () => {
    const { has, settle } = render(assigned, '7K3M-Q9XA-C', { owner: false });
    await settle();
    expect(has('public-owner-banner')).toBe(false);
  });

  it('só há "Enviar onde estou" quando o servidor devolveu um token', async () => {
    const without = render(assigned, '7K3M-Q9XA-C', { owner: false });
    await without.settle();
    expect(without.has('public-rescue-location')).toBe(false);
    TestBed.resetTestingModule();
    const withToken = render(assigned, '7K3M-Q9XA-C', { owner: false, scan_token: 'tok' });
    await withToken.settle();
    expect(withToken.has('public-rescue-location')).toBe(true);
  });

  describe('geolocalização (só depois do toque)', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    afterEach(() => {
      if (original) Object.defineProperty(navigator, 'geolocation', original);
      else Reflect.deleteProperty(navigator, 'geolocation');
    });

    function fakeGeolocation(result: 'allow' | 'deny') {
      const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
        if (result === 'allow') {
          success({ coords: { latitude: -23.5, longitude: -46.6, accuracy: 12.4 } } as GeolocationPosition);
        } else {
          failure?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        }
      });
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
      return getCurrentPosition;
    }

    it('não pede a posição ao abrir a página', async () => {
      const get = fakeGeolocation('allow');
      const { settle } = render(assigned, '7K3M-Q9XA-C', { owner: false, scan_token: 'tok' });
      await settle();
      expect(get).not.toHaveBeenCalled();
    });

    it('permitir: envia a posição com o token e mostra "Localização enviada para Ana"', async () => {
      const get = fakeGeolocation('allow');
      const { byId, scans, settle } = render(assigned, '7K3M-Q9XA-C', { owner: false, scan_token: 'tok' });
      await settle();
      byId('public-rescue-location')?.click();
      await settle();
      expect(get).toHaveBeenCalledTimes(1);
      expect(scans.sendLocation).toHaveBeenCalledWith('tok', { lat: -23.5, lng: -46.6, accuracyM: 12.4 });
      expect(byId('public-rescue-location-sent')?.textContent).toContain('Localização enviada para Ana');
    });

    it('negar: não envia nada e mostra o aviso', async () => {
      fakeGeolocation('deny');
      const { byId, scans, settle } = render(assigned, '7K3M-Q9XA-C', { owner: false, scan_token: 'tok' });
      await settle();
      byId('public-rescue-location')?.click();
      await settle();
      expect(scans.sendLocation).not.toHaveBeenCalled();
      expect(byId('public-rescue-location-denied')).not.toBeNull();
    });

    it('o dono não envia localização (botão desativado)', async () => {
      const get = fakeGeolocation('allow');
      const { byId, settle } = render(assigned, '7K3M-Q9XA-C', { owner: true });
      await settle();
      byId('public-rescue-location')?.click();
      expect(get).not.toHaveBeenCalled();
    });
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
