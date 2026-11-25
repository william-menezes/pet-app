import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SwitchRow } from './switch-row';

@Component({
  imports: [SwitchRow],
  template: `<app-switch-row
    label="Temperamento"
    hint="Dócil com pessoas"
    [(checked)]="on"
    (toggled)="log.push($event)"
    [locked]="locked()"
    data-testid="row" />`,
})
class Host {
  readonly on = signal(true);
  readonly locked = signal(false);
  readonly log: boolean[] = [];
  readonly row = viewChild.required(SwitchRow);
}

const switchButton = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('button[role="switch"]');

describe('SwitchRow', () => {
  it('mostra título e apoio; o interruptor tem o nome do título', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="switch-row-label"]')?.textContent).toContain('Temperamento');
    expect(el.querySelector('[data-testid="switch-row-hint"]')?.textContent).toContain('Dócil com pessoas');
    expect(switchButton(el)?.getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('label')?.textContent).toContain('Temperamento');
  });

  it('o toque inverte o valor, atualiza o model e emite o valor novo', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    switchButton(fixture.nativeElement)!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.on()).toBe(false);
    expect(fixture.componentInstance.log).toEqual([false]);
  });

  it('locked troca o interruptor por "Sempre"', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.locked.set(true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(switchButton(el)).toBeNull();
    expect(el.querySelector('[data-testid="switch-row-locked"]')?.textContent).toContain('Sempre');
  });

  it('setChecked desfaz um toque recusado, por dentro do interruptor também', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    switchButton(fixture.nativeElement)!.click();
    await fixture.whenStable();
    expect(switchButton(fixture.nativeElement)!.getAttribute('aria-checked')).toBe('false');
    fixture.componentInstance.row().setChecked(true);
    await fixture.whenStable();
    expect(switchButton(fixture.nativeElement)!.getAttribute('aria-checked')).toBe('true');
    expect(fixture.componentInstance.on()).toBe(true);
    // Só o toque da pessoa emite; o setChecked da tela não.
    expect(fixture.componentInstance.log).toEqual([false]);
  });
});
