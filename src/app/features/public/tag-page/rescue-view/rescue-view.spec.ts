import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import type { LostElapsed, PublicRescueProfile } from '../../../../models';
import { RescueView, type LocationStatus } from './rescue-view';
import { telHref } from './tel-href';

const base: PublicRescueProfile = { code: '7K3M-Q9XA-C', pet: { name: 'Paçoca' } };
const full: PublicRescueProfile = {
  code: '7K3M-Q9XA-C',
  pet: { name: 'Paçoca', photo_url: 'https://x.supabase.co/storage/v1/object/sign/pet-photos/a.webp?token=t' },
  temperament: ['Dócil com pessoas', 'Medo de barulho'],
  care_notes: 'Tomo remédio para alergia. Não me dê comida, só água.',
  tutor_first_name: 'Ana',
  whatsapp_url: 'https://wa.me/5511987654421?text=Oi',
  phone_display: '(11) 98765-4421',
};

interface Options {
  elapsed?: LostElapsed | null;
  owner?: boolean;
  location?: LocationStatus;
}

function render(profile: PublicRescueProfile, options: Options = {}) {
  TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
  const fixture = TestBed.createComponent(RescueView);
  fixture.componentRef.setInput('profile', profile);
  fixture.componentRef.setInput('lostElapsed', options.elapsed ?? null);
  fixture.componentRef.setInput('ownerView', options.owner ?? false);
  fixture.componentRef.setInput('locationStatus', options.location ?? 'unavailable');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return { fixture, el, byId };
}

describe('RescueView (T031, T061)', () => {
  describe('com tudo liberado', () => {
    it('mostra título, foto, chips, cuidados e o WhatsApp como <a href> no HTML', () => {
      const { byId, el } = render(full);
      expect(byId('public-rescue-title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Oi, eu sou Paçoca.');
      expect(byId('public-rescue-photo')?.getAttribute('src')).toBe(full.pet.photo_url);
      expect(byId('public-rescue-photo')?.getAttribute('alt')).toBe('Foto de Paçoca');
      expect(byId('public-rescue-photo-placeholder')).toBeNull();
      expect(byId('public-rescue-temperament')?.textContent).toContain('Dócil com pessoas');
      expect(byId('public-rescue-temperament')?.textContent).toContain('Medo de barulho');
      expect(byId('public-rescue-care')?.textContent).toContain('Tomo remédio para alergia');
      const whats = byId('public-rescue-whatsapp') as HTMLAnchorElement;
      expect(whats.tagName).toBe('A');
      expect(whats.getAttribute('href')).toBe(full.whatsapp_url);
      expect(whats.textContent).toContain('Avisar Ana no WhatsApp');
      expect(whats.getAttribute('rel')).toContain('noopener');
      expect(byId('public-rescue-phone')?.getAttribute('href')).toBe('tel:+5511987654421');
      expect(el.textContent).toContain('Se você me encontrou, avise Ana.');
      expect(byId('public-footer-trust')?.textContent).toContain('Faro é a tag de identificação de Paçoca.');
      expect(byId('public-footer-trust')?.textContent).toContain('entre você e Ana');
      expect(byId('public-footer-code')?.textContent).toContain('7K3M-Q9XA-C');
      expect(byId('public-rescue-lost')).toBeNull();
    });
  });

  describe('campo ausente não aparece', () => {
    it('sem foto: espaço reservado com o focinho', () => {
      const { byId } = render({ ...full, pet: { name: 'Paçoca' } });
      expect(byId('public-rescue-photo')).toBeNull();
      expect(byId('public-rescue-photo-placeholder')).not.toBeNull();
    });
    it('sem temperamento e sem cuidados', () => {
      const { byId } = render({ ...full, temperament: undefined, care_notes: undefined });
      expect(byId('public-rescue-temperament')).toBeNull();
      expect(byId('public-rescue-care')).toBeNull();
    });
    it('sem WhatsApp: nenhum botão de WhatsApp, o telefone segue', () => {
      const { byId } = render({ ...full, whatsapp_url: undefined });
      expect(byId('public-rescue-whatsapp')).toBeNull();
      expect(byId('public-rescue-phone')).not.toBeNull();
    });
    it('sem telefone: só o WhatsApp', () => {
      const { byId } = render({ ...full, phone_display: undefined });
      expect(byId('public-rescue-phone')).toBeNull();
      expect(byId('public-rescue-whatsapp')).not.toBeNull();
    });
    it('sem nome do tutor: texto neutro, sem inventar nome', () => {
      const { byId, el } = render({ ...full, tutor_first_name: undefined });
      expect(byId('public-rescue-whatsapp')?.textContent).toContain('Avisar a família no WhatsApp');
      expect(el.textContent).toContain('avise minha família');
      expect(byId('public-footer-trust')?.textContent).not.toContain('entre você e');
    });
    it('sem nenhum contato: nota para procurar clínica ou ONG, nunca um beco sem saída', () => {
      const { byId } = render(base);
      expect(byId('public-rescue-whatsapp')).toBeNull();
      expect(byId('public-rescue-phone')).toBeNull();
      expect(byId('public-rescue-no-contact')?.textContent).toContain('clínica veterinária');
    });
    it('perfil mínimo: só o que veio (nome e código)', () => {
      const { el } = render(base);
      expect(el.querySelector('[data-testid="public-rescue-title"]')).not.toBeNull();
      expect(el.textContent).not.toContain('undefined');
      expect(el.textContent).not.toContain('null');
    });
  });

  describe('modo perdido', () => {
    const lost = { since: '2026-11-19T10:00:00Z', reward: true as const, message: 'Ele se assusta fácil. Fale baixo.' };

    it('bloco âmbar com o título, o tempo calculado no servidor, a recompensa e o recado', () => {
      const { byId } = render({ ...full, lost }, { elapsed: { unit: 'days', amount: 2 } });
      expect(byId('public-rescue-lost')?.className).toContain('bg-lost');
      expect(byId('public-rescue-title')?.textContent).toContain('Sou Paçoca.');
      expect(byId('public-rescue-title')?.textContent).toContain('Me perdi de casa.');
      expect(byId('public-rescue-elapsed')?.textContent?.replace(/\s+/g, ' ')).toContain('Longe de casa há 2 dias');
      expect(byId('public-rescue-reward')).not.toBeNull();
      expect(byId('public-rescue-message')?.textContent).toContain('Recado de Ana');
      expect(byId('public-rescue-message')?.textContent).toContain('Ele se assusta fácil');
    });

    it('singular e horas', () => {
      const a = render({ ...full, lost }, { elapsed: { unit: 'hours', amount: 1 } });
      expect(a.byId('public-rescue-elapsed')?.textContent?.replace(/\s+/g, ' ')).toContain('há 1 hora');
      TestBed.resetTestingModule();
      const b = render({ ...full, lost }, { elapsed: { unit: 'days', amount: 1 } });
      expect(b.byId('public-rescue-elapsed')?.textContent?.replace(/\s+/g, ' ')).toContain('há 1 dia');
    });

    it('cada item só aparece se veio: sem tempo, sem recompensa, sem recado', () => {
      const { byId } = render({ ...full, lost: {} });
      expect(byId('public-rescue-lost')).not.toBeNull();
      expect(byId('public-rescue-elapsed')).toBeNull();
      expect(byId('public-rescue-reward')).toBeNull();
      expect(byId('public-rescue-message')).toBeNull();
    });

    it('tempo sem `since` na projeção não aparece mesmo se o servidor mandou o cálculo', () => {
      const { byId } = render({ ...full, lost: { reward: true } }, { elapsed: { unit: 'days', amount: 3 } });
      expect(byId('public-rescue-elapsed')).toBeNull();
      expect(byId('public-rescue-reward')).not.toBeNull();
    });

    it('o botão do WhatsApp continua sendo um link', () => {
      const { byId } = render({ ...full, lost });
      expect((byId('public-rescue-whatsapp') as HTMLAnchorElement).getAttribute('href')).toBe(full.whatsapp_url);
    });
  });

  describe('visão do dono', () => {
    it('faixa, botões de contato desativados e nenhum link de contato', () => {
      const { byId } = render(full, { owner: true, location: 'idle' });
      expect(byId('public-owner-banner')?.textContent).toContain('Você está vendo como um estranho');
      expect(byId('public-owner-banner')?.textContent).toContain('Este scan não gera aviso');
      expect(byId('public-owner-edit')?.tagName).toBe('A');
      const whats = byId('public-rescue-whatsapp') as HTMLButtonElement;
      expect(whats.tagName).toBe('BUTTON');
      expect(whats.disabled).toBe(true);
      expect(byId('public-rescue-phone')?.getAttribute('href')).toBeNull();
      expect((byId('public-rescue-location') as HTMLButtonElement).disabled).toBe(true);
      expect(byId('public-owner-note')).not.toBeNull();
    });

    it('sem a visão do dono não há faixa', () => {
      expect(render(full).byId('public-owner-banner')).toBeNull();
    });
  });

  describe('"Enviar onde estou"', () => {
    it('escondido enquanto não há como enviar', () => {
      expect(render(full, { location: 'unavailable' }).byId('public-rescue-location')).toBeNull();
    });

    it('parado: o toque emite o evento', () => {
      const { fixture, byId } = render(full, { location: 'idle' });
      const spy = vi.fn();
      fixture.componentInstance.shareLocation.subscribe(spy);
      byId('public-rescue-location')?.click();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(byId('public-rescue-location')?.textContent).toContain('Enviar onde estou para Ana');
    });

    it('enviando: desativado; enviado: confirmação; negado: aviso', () => {
      expect((render(full, { location: 'sending' }).byId('public-rescue-location') as HTMLButtonElement).disabled).toBe(true);
      TestBed.resetTestingModule();
      const sent = render(full, { location: 'sent' });
      expect(sent.byId('public-rescue-location-sent')?.textContent).toContain('Localização enviada para Ana');
      expect(sent.byId('public-rescue-location')).toBeNull();
      TestBed.resetTestingModule();
      const denied = render(full, { location: 'denied' });
      expect(denied.byId('public-rescue-location-denied')).not.toBeNull();
    });
  });

  it('nenhum routerLink: links para fora da página são <a href> comuns', () => {
    const { el } = render(full, { owner: true });
    expect(el.querySelector('[routerlink]')).toBeNull();
  });
});

describe('telHref', () => {
  it('monta tel: com +55 a partir do texto de exibição', () => {
    expect(telHref('(11) 98765-4421')).toBe('tel:+5511987654421');
    expect(telHref('(11) 3456-7890')).toBe('tel:+551134567890');
    expect(telHref('+55 11 98765-4421')).toBe('tel:+5511987654421');
  });
  it('devolve null sem 10 ou 11 dígitos', () => {
    expect(telHref('12345')).toBeNull();
    expect(telHref('')).toBeNull();
  });
});
