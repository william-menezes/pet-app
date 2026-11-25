import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminCodeRow } from '../../../models';
import { AdminCodes } from './codes';

const row = (code: string, over: Partial<AdminCodeRow> = {}): AdminCodeRow => ({
  code,
  batchId: 'lote-900',
  status: 'available',
  petName: null,
  tutor: null,
  lastScanAt: null,
  ...over,
});

const ROWS: AdminCodeRow[] = [
  row('7K3M-Q9XA-C', { status: 'assigned', petName: 'Paçoca', tutor: 'Ana S.', lastScanAt: '2026-11-20T15:00:00Z' }),
  row('2FX8-CN73-F'),
  row('T6EV-BXPY-W', { status: 'blocked', lastScanAt: '2026-11-12T12:00:00Z' }),
];

describe('AdminCodes (T079)', () => {
  let fixture: ComponentFixture<AdminCodes>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const chip = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="admin-codes-filters"] button')].find((b) => b.textContent?.trim() === label)!;
  const search = async (text: string) => {
    const input = byId('admin-codes-search') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
    byId('admin-codes-search-submit')!.click();
    await settle();
  };

  async function create(over: { list?: ReturnType<typeof vi.fn>; batches?: unknown } = {}) {
    list = over.list ?? vi.fn().mockResolvedValue({ ok: true, page: { total: ROWS.length, rows: ROWS } });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        {
          provide: AdminTagService,
          useValue: {
            listCodes: list,
            listBatches: vi.fn().mockResolvedValue(over.batches ?? { ok: true, batches: [{ id: 'lote-900' }, { id: 'lote-901' }] }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(AdminCodes);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('lista os códigos em cartões e em tabela, com situação, pet e tutor e último scan', async () => {
    await create();
    expect(byId('admin-heading-subtitle')?.textContent).toContain('3 códigos');
    expect(all('admin-code-card')).toHaveLength(3);
    expect(all('admin-code-row')).toHaveLength(3);
    const first = all('admin-code-card')[0].textContent ?? '';
    expect(first).toContain('7K3M-Q9XA-C');
    expect(first).toContain('Ativo');
    expect(first).toContain('Paçoca · Ana S.');
    expect(first).toContain('Último scan');
    expect(all('admin-code-card')[1].textContent).toContain('Sem vínculo');
    expect(all('admin-code-card')[1].textContent).toContain('Nunca escaneada');
    expect(all('admin-code-card')[2].textContent).toContain('Bloqueado');
    expect(all('admin-code-link')[0].getAttribute('href')).toBe('/admin/codigos/7K3M-Q9XA-C');
  });

  it('busca: manda o texto, volta para a primeira página e mostra o resultado', async () => {
    await create();
    await search('  paçoca ');
    const last = list.mock.calls.at(-1)![0];
    expect(last).toMatchObject({ search: 'paçoca', status: null, batch: null, offset: 0 });
  });

  it('filtro por situação manda o status; "Todos" tira o filtro', async () => {
    await create();
    chip('Ativos').click();
    await settle();
    expect(list.mock.calls.at(-1)![0]).toMatchObject({ status: 'assigned', offset: 0 });
    chip('Bloqueados').click();
    await settle();
    expect(list.mock.calls.at(-1)![0]).toMatchObject({ status: 'blocked' });
    chip('Todos').click();
    await settle();
    expect(list.mock.calls.at(-1)![0]).toMatchObject({ status: null });
  });

  it('filtro por lote manda o lote', async () => {
    await create();
    const select = byId('admin-codes-batch') as HTMLSelectElement;
    select.value = 'lote-901';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(list.mock.calls.at(-1)![0]).toMatchObject({ batch: 'lote-901' });
  });

  it('sem a lista de lotes, a tela segue sem o filtro de lote', async () => {
    await create({ batches: { ok: false, error: 'network' } });
    expect(byId('admin-codes-batch')).toBeNull();
    expect(all('admin-code-card')).toHaveLength(3);
  });

  it('paginação: próxima e anterior mudam o deslocamento; a faixa mostra "26–50 de 60"', async () => {
    const many = vi.fn().mockResolvedValue({ ok: true, page: { total: 60, rows: ROWS } });
    await create({ list: many });
    expect(byId('admin-codes-range')?.textContent?.trim()).toBe('1–25 de 60');
    expect(byId('admin-codes-prev')?.hasAttribute('disabled')).toBe(true);
    byId('admin-codes-next')!.click();
    await settle();
    expect(many.mock.calls.at(-1)![0]).toMatchObject({ offset: 25, limit: 25 });
    expect(byId('admin-codes-range')?.textContent?.trim()).toBe('26–50 de 60');
    byId('admin-codes-prev')!.click();
    await settle();
    expect(many.mock.calls.at(-1)![0]).toMatchObject({ offset: 0 });
  });

  it('seleção: conta, limpa, e "Reimprimir seleção" fica desativado com o motivo (etiquetas bloqueadas)', async () => {
    await create();
    expect(byId('admin-codes-reprint')?.hasAttribute('disabled')).toBe(true);
    expect(byId('admin-codes-reprint-note')?.textContent).toContain('geração das etiquetas');
    const boxes = all('admin-code-select');
    (boxes[0].querySelector('input') as HTMLInputElement).click();
    (boxes[1].querySelector('input') as HTMLInputElement).click();
    await settle();
    expect(byId('admin-codes-selected')?.textContent).toContain('2 selecionados');
    expect(byId('admin-codes-reprint')?.textContent).toContain('(2)');
    expect(byId('admin-codes-reprint')?.hasAttribute('disabled')).toBe(true);
    byId('admin-codes-selection-clear')!.click();
    await settle();
    expect(byId('admin-codes-selected')).toBeNull();
  });

  it('sem resultado: estado vazio com "Limpar busca e filtros" que volta à lista', async () => {
    const empty = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, page: { total: 0, rows: [] } })
      .mockResolvedValue({ ok: true, page: { total: 3, rows: ROWS } });
    await create({ list: empty });
    expect(byId('admin-codes-empty')).not.toBeNull();
    byId('admin-codes-clear')!.click();
    await settle();
    expect(byId('admin-codes-empty')).toBeNull();
    expect(all('admin-code-card')).toHaveLength(3);
  });

  it('erro de rede tem "Tentar de novo"; forbidden não tem', async () => {
    const failing = vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, page: { total: 3, rows: ROWS } });
    await create({ list: failing });
    expect(byId('admin-codes-error')?.textContent).toContain('Não conseguimos conectar');
    byId('admin-codes-retry')!.click();
    await settle();
    expect(byId('admin-codes-error')).toBeNull();

    TestBed.resetTestingModule();
    await create({ list: vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }) });
    expect(byId('admin-codes-error')?.textContent).toContain('não tem acesso');
    expect(byId('admin-codes-retry')).toBeNull();
  });
});
