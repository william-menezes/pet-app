import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PublicFooter } from './public-footer';
import { PublicLayout } from './public-layout';

@Component({
  imports: [PublicLayout, PublicFooter],
  template: `
    <app-public-layout [media]="media()">
      <div media data-testid="host-media">Faixa</div>
      <p data-testid="host-body">Corpo</p>
      <app-public-footer footer trust="Faro é a tag de identificação do seu pet." [code]="code()" />
    </app-public-layout>
  `,
})
class Host {
  readonly media = signal<'photo' | 'photo-short' | 'band'>('band');
  readonly code = signal<string | null>(null);
}

describe('PublicLayout e PublicFooter', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }
  const byId = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('projeta a faixa, o corpo (dentro de um <main>) e o rodapé', () => {
    const el = render().nativeElement as HTMLElement;
    expect(byId(el, 'public-layout-media')?.contains(byId(el, 'host-media'))).toBe(true);
    expect(byId(el, 'host-body')?.closest('main')).not.toBeNull();
    expect(byId(el, 'public-layout-sheet')?.contains(byId(el, 'host-body'))).toBe(true);
    expect(byId(el, 'public-footer')).not.toBeNull();
    expect(byId(el, 'public-layout-sheet')?.contains(byId(el, 'public-footer'))).toBe(false);
  });

  it('a altura da faixa muda com media (celular e tablet)', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const media = () => (byId(el, 'public-layout-media') as HTMLElement).className;
    expect(media()).toContain('h-[230px]');
    expect(media()).toContain('md:h-[330px]');
    fixture.componentInstance.media.set('photo');
    fixture.detectChanges();
    expect(media()).toContain('h-[300px]');
    expect(media()).toContain('md:h-[410px]');
    fixture.componentInstance.media.set('photo-short');
    fixture.detectChanges();
    expect(media()).toContain('h-[250px]');
    expect(media()).toContain('md:h-[350px]');
  });

  it('no desktop a faixa ocupa a altura toda e metade da largura', () => {
    const cls = (byId(render().nativeElement, 'public-layout-media') as HTMLElement).className;
    expect(cls).toContain('xl:h-auto');
    expect(cls).toContain('xl:w-1/2');
  });

  it('o rodapé mostra a linha de confiança e "Tag " + código só quando o código é informado', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(byId(el, 'public-footer-trust')?.textContent?.trim()).toBe('Faro é a tag de identificação do seu pet.');
    expect(byId(el, 'public-footer-code')).toBeNull();
    fixture.componentInstance.code.set('7K3M-Q9XA-C');
    fixture.detectChanges();
    expect(byId(el, 'public-footer-code')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Tag 7K3M-Q9XA-C');
  });
});
