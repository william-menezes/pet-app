import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ZardSonnerService } from '@/shared/components/sonner';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminQueue } from '../../../models';
import { AdminQueuePage } from './queue';

const QUEUE: AdminQueue = {
  scans: [
    { id: 's1', code: 'T6EV-BXPY-W', statusAtScan: 'blocked', occurredAt: '2026-11-25T13:12:00Z', geoMethod: 'ip', city: 'São Paulo', region: 'SP' },
    { id: 's2', code: '2FX8-CN73-F', statusAtScan: 'available', occurredAt: '2026-11-18T11:03:00Z', geoMethod: 'none', city: null, region: null },
  ],
  replacements: [{ id: 'r1', code: '7K3M-Q9XA-C', kind: 'damaged', createdAt: '2026-11-19T12:00:00Z' }],
  lockedTags: [{ code: 'TJ27-9DDB-B', lockedUntil: '2026-11-26T12:15:00Z' }],
};

describe('AdminQueuePage (T081)', () => {
  let fixture: ComponentFixture<AdminQueuePage>;
  let el: HTMLElement;
  let admin: Record<'scanQueue' | 'resolveReplacement', ReturnType<typeof vi.fn>>;
  let sonner: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const chip = (start: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="admin-queue-filters"] button')].find((b) => b.textContent?.trim().startsWith(start))!;

  async function create(over: Partial<typeof admin> = {}) {
    admin = {
      scanQueue: vi.fn().mockResolvedValue({ ok: true, queue: QUEUE }),
      resolveReplacement: vi.fn().mockResolvedValue({ ok: true }),
      ...over,
    };
    sonner = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: AdminTagService, useValue: admin },
        { provide: ZardSonnerService, useValue: sonner },
      ],
    });
    fixture = TestBed.createComponent(AdminQueuePage);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('mostra as três seções com os números nos chips', async () => {
    await create();
    expect(chip('Tudo').textContent).toContain('4');
    expect(chip('Scans sem vínculo').textContent).toContain('2');
    expect(chip('2ª via').textContent).toContain('1');
    expect(chip('Travadas').textContent).toContain('1');
    expect(all('admin-queue-scan')).toHaveLength(2);
    expect(all('admin-queue-replacement')).toHaveLength(1);
    expect(all('admin-queue-locked-item')).toHaveLength(1);
    const first = all('admin-queue-scan')[0];
    expect(first.textContent).toContain('T6EV-BXPY-W');
    expect(first.textContent).toContain('Bloqueado');
    expect(first.textContent).toContain('São Paulo, SP · aproximada');
    expect(all('admin-queue-scan')[1].textContent).toContain('Disponível');
    expect(all('admin-queue-scan')[1].textContent).toContain('Sem localização');
    expect(all('admin-queue-code')[0].getAttribute('href')).toBe('/admin/codigos/T6EV-BXPY-W');
  });

  it('chip filtra por seção', async () => {
    await create();
    chip('2ª via').click();
    await settle();
    expect(byId('admin-queue-scans')).toBeNull();
    expect(byId('admin-queue-replacements')).not.toBeNull();
    expect(byId('admin-queue-locked')).toBeNull();
    chip('Travadas').click();
    await settle();
    expect(byId('admin-queue-locked')).not.toBeNull();
    expect(byId('admin-queue-replacements')).toBeNull();
    chip('Tudo').click();
    await settle();
    expect(byId('admin-queue-scans')).not.toBeNull();
  });

  it('"Marcar como resolvido" fecha o pedido e tira a linha da fila', async () => {
    await create();
    byId('admin-queue-resolve')!.click();
    await settle();
    expect(admin.resolveReplacement).toHaveBeenCalledWith('r1', 'done');
    expect(sonner.success).toHaveBeenCalled();
    expect(all('admin-queue-replacement')).toHaveLength(0);
    expect(byId('admin-queue-replacements-empty')).not.toBeNull();
    expect(chip('2ª via').textContent).toContain('0');
  });

  it('erro ao resolver mantém a linha e avisa', async () => {
    await create({ resolveReplacement: vi.fn().mockResolvedValue({ ok: false, error: 'invalid_transition' }) });
    byId('admin-queue-resolve')!.click();
    await settle();
    expect(sonner.error).toHaveBeenCalled();
    expect(all('admin-queue-replacement')).toHaveLength(1);
  });

  it('fila vazia: estado vazio com caminho para os códigos', async () => {
    await create({ scanQueue: vi.fn().mockResolvedValue({ ok: true, queue: { scans: [], replacements: [], lockedTags: [] } }) });
    expect(byId('admin-queue-empty')).not.toBeNull();
    expect(byId('admin-queue-empty-codes')?.getAttribute('href')).toBe('/admin/codigos');
  });

  it('seção sem itens diz isso, não some', async () => {
    await create({ scanQueue: vi.fn().mockResolvedValue({ ok: true, queue: { ...QUEUE, scans: [] } }) });
    expect(byId('admin-queue-scans-empty')).not.toBeNull();
  });

  it('erro de rede tem "Tentar de novo"; forbidden não tem', async () => {
    await create({ scanQueue: vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, queue: QUEUE }) });
    expect(byId('admin-queue-error')?.textContent).toContain('Não conseguimos conectar');
    byId('admin-queue-retry')!.click();
    await settle();
    expect(byId('admin-queue-error')).toBeNull();

    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ scanQueue: vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }) });
    expect(byId('admin-queue-retry')).toBeNull();
  });
});
