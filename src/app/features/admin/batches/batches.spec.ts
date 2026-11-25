import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ZardSonnerService } from '@/shared/components/sonner';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import { FileSaver } from '../../../core/admin/save-file';
import type { AdminBatch } from '../../../models';
import { AdminBatches } from './batches';

const BATCH: AdminBatch = {
  id: 'lote-900',
  quantity: 54,
  createdAt: '2026-11-17T13:00:00Z',
  notes: 'Primeira impressão',
  packageDownloadedAt: '2026-11-17T13:05:00Z',
  counts: { available: 41, assigned: 12, blocked: 0, void: 1 },
};
const COUNTERS = { generated: 54, available: 41, active: 12, blocked: 0, void: 1 };

describe('AdminBatches (T078)', () => {
  let fixture: ComponentFixture<AdminBatches>;
  let el: HTMLElement;
  let admin: Record<'counters' | 'listBatches' | 'createBatch' | 'exportCodes', ReturnType<typeof vi.fn>>;
  const save = vi.fn();
  let sonner: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const type = async (id: string, value: string) => {
    const input = byId(id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const click = async (id: string) => {
    byId(id)?.click();
    await settle();
  };

  async function create(over: Partial<typeof admin> = {}) {
    admin = {
      counters: vi.fn().mockResolvedValue({ ok: true, counters: COUNTERS }),
      listBatches: vi.fn().mockResolvedValue({ ok: true, batches: [BATCH] }),
      createBatch: vi.fn(),
      exportCodes: vi.fn(),
      ...over,
    };
    sonner = { success: vi.fn(), error: vi.fn() };
    save.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: AdminTagService, useValue: admin },
        { provide: ZardSonnerService, useValue: sonner },
        { provide: FileSaver, useValue: { save } },
      ],
    });
    fixture = TestBed.createComponent(AdminBatches);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }


  it('mostra contadores, o lote (cartão e linha da tabela) e o aviso do pacote', async () => {
    await create();
    expect(byId('admin-heading-title')?.textContent).toContain('Lotes de tags');
    expect(byId('admin-batches-counters')?.textContent).toContain('54');
    expect(byId('admin-batches-counters')?.textContent).toContain('1 lote');
    expect(all('admin-batch-card')).toHaveLength(1);
    expect(all('admin-batch-row')).toHaveLength(1);
    expect(all('admin-batch-card')[0].textContent).toContain('lote-900');
    expect(all('admin-batch-card')[0].textContent).toContain('12 ativos');
    expect(all('admin-batch-card')[0].textContent).toContain('Baixado');
    expect(byId('admin-batches-notice')?.textContent).toContain('uma vez só');
  });

  it('lote sem pacote baixado aparece como "Não baixado"', async () => {
    await create({ listBatches: vi.fn().mockResolvedValue({ ok: true, batches: [{ ...BATCH, packageDownloadedAt: null }] }) });
    expect(all('admin-batch-card')[0].textContent).toContain('Não baixado');
  });

  it('sem lotes: convite para criar o primeiro', async () => {
    await create({ listBatches: vi.fn().mockResolvedValue({ ok: true, batches: [] }) });
    expect(byId('admin-batches-empty')).not.toBeNull();
    await click('admin-batches-empty-create');
    expect(byId('admin-batches-panel')).not.toBeNull();
  });

  it('erro de rede: mensagem e "Tentar de novo" que recarrega', async () => {
    await create({ counters: vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, counters: COUNTERS }) });
    expect(byId('admin-batches-error')?.textContent).toContain('Não conseguimos conectar');
    await click('admin-batches-retry');
    expect(byId('admin-batches-error')).toBeNull();
    expect(all('admin-batch-card')).toHaveLength(1);
  });

  it('forbidden: mensagem sem botão de tentar de novo', async () => {
    await create({ counters: vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }) });
    expect(byId('admin-batches-error')?.textContent).toContain('não tem acesso');
    expect(byId('admin-batches-retry')).toBeNull();
  });

  describe('criar lote', () => {
    it('quantidade inválida desativa "Continuar" e mostra o erro; vazia, zero, 501 e texto', async () => {
      await create();
      await click('admin-batches-create');
      for (const bad of ['', '0', '501', 'abc', '1.5']) {
        await type('admin-batches-quantity', bad);
        expect(byId('admin-batches-quantity-error'), bad).not.toBeNull();
        expect(byId('admin-batches-continue')?.hasAttribute('disabled'), bad).toBe(true);
      }
      await type('admin-batches-quantity', '54');
      expect(byId('admin-batches-quantity-error')).toBeNull();
    });

    it('pede confirmação antes de gerar e só então chama a função, salva o pacote e solta o arquivo', async () => {
      const blob = new Blob(['code,pin\n']);
      await create({ createBatch: vi.fn().mockResolvedValue({ ok: true, batchId: 'lote-901', blob }) });
      await click('admin-batches-create');
      await type('admin-batches-quantity', '10');
      await type('admin-batches-notes', 'Segunda leva');
      await click('admin-batches-continue');
      expect(admin.createBatch).not.toHaveBeenCalled();
      expect(byId('admin-batches-panel')?.textContent).toContain('Gerar 10 códigos?');

      await click('admin-batches-generate');
      expect(admin.createBatch).toHaveBeenCalledWith(10, 'Segunda leva');
      expect(save).toHaveBeenCalledWith(blob, 'lote-901.zip');
      expect(byId('admin-batches-done')?.textContent).toContain('lote-901.zip');
      // O Blob não fica em nenhum signal do componente depois de salvo.
      const held = Object.values(fixture.componentInstance as unknown as Record<string, unknown>).some(
        (v) => typeof v === 'function' && 'set' in (v as object) && (v as () => unknown)() instanceof Blob,
      );
      expect(held).toBe(false);
      // A lista foi relida para mostrar o lote novo.
      expect(admin.listBatches.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('"Voltar" na confirmação não gera nada', async () => {
      await create();
      await click('admin-batches-create');
      await click('admin-batches-continue');
      await click('admin-batches-back');
      expect(byId('admin-batches-quantity')).not.toBeNull();
      expect(admin.createBatch).not.toHaveBeenCalled();
    });

    it('too_many_requests fica na confirmação com a mensagem; rede orienta a reemitir PINs', async () => {
      await create({
        createBatch: vi.fn().mockResolvedValueOnce({ ok: false, error: 'too_many_requests' }).mockResolvedValueOnce({ ok: false, error: 'network' }),
      });
      await click('admin-batches-create');
      await click('admin-batches-continue');
      await click('admin-batches-generate');
      expect(byId('admin-batches-problem')?.textContent).toContain('Muitas ações em pouco tempo');
      expect(save).not.toHaveBeenCalled();
      await click('admin-batches-generate');
      expect(byId('admin-batches-problem')?.textContent).toContain('reemita o PIN');
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('exportar códigos', () => {
    it('baixa o CSV só com códigos', async () => {
      await create({ exportCodes: vi.fn().mockResolvedValue({ ok: true, batchId: 'lote-900', count: 54, csv: 'code,qr_version,qr_mask\n' }) });
      await click('admin-batch-export');
      expect(admin.exportCodes).toHaveBeenCalledWith('lote-900');
      expect(save).toHaveBeenCalledTimes(1);
      const [blob, name] = save.mock.calls[0] as [Blob, string];
      expect(name).toBe('lote-900-codigos.csv');
      expect(await blob.text()).not.toMatch(/pin/i.source === 'pin' ? /,pin\b/ : /x^/);
      expect(sonner.success).toHaveBeenCalled();
    });

    it('erro vira aviso e nada é baixado', async () => {
      await create({ exportCodes: vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }) });
      await click('admin-batch-export');
      expect(save).not.toHaveBeenCalled();
      expect(sonner.error).toHaveBeenCalled();
    });
  });
});
