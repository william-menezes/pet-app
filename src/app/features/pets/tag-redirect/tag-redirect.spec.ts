import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';
import { TagRedirect } from './tag-redirect';

const pet = (id: string, tagCode: string | null): DashboardPet => ({
  id,
  name: id,
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: tagCode !== null,
  tagCode,
  tagStatus: tagCode === null ? null : 'assigned',
  scansMonth: 0,
  lastScan: null,
  visibleShown: 0,
  visibleTotal: 5,
});

describe('TagRedirect', () => {
  let fixture: ComponentFixture<TagRedirect>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function create(code: string, dashboard: unknown) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TagService, useValue: { myDashboard: vi.fn().mockResolvedValue(dashboard) } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TagRedirect);
    fixture.componentRef.setInput('code', code);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const ok = (pets: DashboardPet[]) => ({ ok: true, dashboard: { pets, pendingActivation: null } });

  it('acha o pet pelo código (qualquer forma de escrever) e abre "O que estranhos veem"', async () => {
    await create('7k3m-q9xa-c', ok([pet('p1', null), pet('p2', '7K3M-Q9XA-C')]));
    expect(navigate).toHaveBeenCalledWith(['/app/pets', 'p2', 'visibilidade'], { replaceUrl: true });
  });

  it('código que não é de um pet do tutor: lista de pets', async () => {
    await create('2FX8CN73F', ok([pet('p1', '7K3M-Q9XA-C')]));
    expect(navigate).toHaveBeenCalledWith(['/app/pets'], { replaceUrl: true });
  });

  it('falha de rede: aviso com "Tentar de novo" e caminho para os pets', async () => {
    await create('7K3MQ9XAC', { ok: false, error: 'network' });
    const el = fixture.nativeElement as HTMLElement;
    expect(navigate).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="tag-redirect-retry"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tag-redirect-pets"]')?.getAttribute('href')).toBe('/app/pets');
  });
});
