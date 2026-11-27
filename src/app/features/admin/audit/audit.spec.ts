import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { AUDIT_PAGE_SIZE, AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminAuditRow } from '../../../models';
import { AdminAuditPage } from './audit';

const row = (id: string, event: string, over: Partial<AdminAuditRow> = {}): AdminAuditRow => ({
  id,
  at: '2026-11-25T17:32:00Z',
  actorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  actorRole: 'admin',
  event,
  entity: 'tag',
  entityId: '7K3MQ9XAC',
  detail: null,
  ...over,
});

const ROWS = [
  row('1', 'pin_reissued', { actorRole: 'authenticated', detail: { reason: 'lost' } }),
  row('2', 'activation_failed', { actorRole: 'authenticated', detail: { fail_count: 2 } }),
  row('3', 'batch_created', { entity: 'batch', entityId: 'lote-900', detail: { count: 54 } }),
  row('4', 'evento_novo_que_ninguem_mapeou', { actorRole: null }),
];

describe('AdminAuditPage (T082)', () => {
  let fixture: ComponentFixture<AdminAuditPage>;
  let el: HTMLElement;
  let audit: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const chip = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="admin-audit-filters"] button')].find((b) => b.textContent?.trim() === label)!;

  async function create(fn?: ReturnType<typeof vi.fn>) {
    audit = fn ?? vi.fn().mockResolvedValue({ ok: true, rows: ROWS });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideIcons(faroIcons), { provide: AdminTagService, useValue: { audit } }],
    });
    fixture = TestBed.createComponent(AdminAuditPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('lista os eventos com nome em português, código formatado, papel de quem fez e detalhe', async () => {
    await create();
    const rows = all('admin-audit-row');
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('PIN reemitido');
    expect(rows[0].textContent).toContain('pin_reissued');
    expect(rows[0].textContent).toContain('7K3M-Q9XA-C');
    expect(rows[0].textContent).toContain('conta logada');
    expect(rows[0].textContent).toContain('tag perdida');
    expect(rows[1].textContent).toContain('PIN errado');
    expect(rows[1].textContent).toContain('tentativa 2');
    expect(rows[2].textContent).toContain('lote-900');
    expect(rows[2].textContent).toContain('54 códigos');
    // Evento sem nome mapeado aparece pelo código; sem papel é "sistema".
    expect(rows[3].textContent).toContain('evento_novo_que_ninguem_mapeou');
    expect(rows[3].textContent).toContain('sistema');
    expect(byId('admin-audit-count')?.textContent).toContain('4 eventos');
  });

  it('o detalhe de mudança de situação vira "disponível → bloqueado"; evento de pet não mostra o identificador interno', async () => {
    await create(
      vi.fn().mockResolvedValue({
        ok: true,
        rows: [
          row('7', 'tag_status_changed', { detail: { from: 'available', to: 'blocked', note: 'teste' } }),
          row('8', 'lost_mode_on', { entity: 'pet', entityId: '11111111-1111-4111-8111-111111111111' }),
          row('9', 'replacement_resolved', { detail: { request_id: 'x', status: 'done' } }),
        ],
      }),
    );
    const rows = all('admin-audit-row');
    expect(rows[0].textContent).toContain('disponível → bloqueado · teste');
    expect(rows[1].textContent).toContain('Pet');
    expect(el.textContent).not.toContain('11111111-1111');
    expect(rows[2].textContent).toContain('resolvido');
    expect(el.textContent).not.toContain('available');
  });

  it('nunca mostra o identificador da conta nem PIN, telefone ou IP', async () => {
    await create();
    expect(el.textContent).not.toContain('ffffffff');
    expect(byId('admin-audit-note')?.textContent).toContain('nunca guarda PIN');
  });

  it('detalhe com chaves desconhecidas não vaza: só as conhecidas viram texto', async () => {
    await create(
      vi.fn().mockResolvedValue({ ok: true, rows: [row('9', 'pin_reissued', { detail: { ip_hash: 'abc123', phone: '+5511999999999', reason: 'ok' } })] }),
    );
    expect(el.textContent).not.toContain('abc123');
    expect(el.textContent).not.toContain('5511999999999');
    expect(all('admin-audit-row')[0].textContent).toContain('ok');
  });

  it('chip de grupo filtra as linhas carregadas', async () => {
    await create();
    chip('PIN').click();
    await settle();
    expect(all('admin-audit-row')).toHaveLength(1);
    chip('Lotes').click();
    await settle();
    expect(all('admin-audit-row')[0].textContent).toContain('lote-900');
    chip('Todos').click();
    await settle();
    expect(all('admin-audit-row')).toHaveLength(4);
  });

  it('filtro por código manda o texto ao banco e recomeça do início', async () => {
    await create();
    const input = byId('admin-audit-entity') as HTMLInputElement;
    input.value = ' 7k3m-q9xa-c ';
    input.dispatchEvent(new Event('input'));
    await settle();
    byId('admin-audit-entity-submit')!.click();
    await settle();
    expect(audit.mock.calls.at(-1)![0]).toMatchObject({ entityId: '7k3m-q9xa-c', offset: 0 });
  });

  it('"Carregar mais" só aparece com página cheia e anexa as linhas seguintes', async () => {
    await create();
    expect(byId('admin-audit-more')).toBeNull();

    TestBed.resetTestingModule();
    fixture.destroy();
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) => row(`a${i}`, 'pin_reissued'));
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, rows: full })
      .mockResolvedValueOnce({ ok: true, rows: [row('b1', 'batch_created', { entityId: 'lote-901' })] });
    await create(fn);
    expect(all('admin-audit-row')).toHaveLength(AUDIT_PAGE_SIZE);
    byId('admin-audit-more')!.click();
    await settle();
    expect(fn.mock.calls[1][0]).toMatchObject({ offset: AUDIT_PAGE_SIZE });
    expect(all('admin-audit-row')).toHaveLength(AUDIT_PAGE_SIZE + 1);
    expect(byId('admin-audit-more')).toBeNull();
  });

  it('chip sem nenhum evento nas linhas carregadas e com mais a carregar oferece "Carregar mais"', async () => {
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) => row(`a${i}`, 'pin_reissued'));
    await create(vi.fn().mockResolvedValue({ ok: true, rows: full }));
    chip('Lotes').click();
    await settle();
    expect(byId('admin-audit-empty')).not.toBeNull();
    expect(byId('admin-audit-empty-more')).not.toBeNull();
  });

  it('sem eventos: estado vazio com "Ver todos os eventos"', async () => {
    await create(vi.fn().mockResolvedValue({ ok: true, rows: [] }));
    expect(byId('admin-audit-empty')).not.toBeNull();
    expect(byId('admin-audit-clear')).not.toBeNull();
  });

  it('erro ao carregar mais não derruba a lista', async () => {
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) => row(`a${i}`, 'pin_reissued'));
    await create(vi.fn().mockResolvedValueOnce({ ok: true, rows: full }).mockResolvedValueOnce({ ok: false, error: 'network' }));
    byId('admin-audit-more')!.click();
    await settle();
    expect(byId('admin-audit-more-error')).not.toBeNull();
    expect(all('admin-audit-row')).toHaveLength(AUDIT_PAGE_SIZE);
  });

  it('erro de rede tem "Tentar de novo"; forbidden não tem', async () => {
    await create(vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, rows: ROWS }));
    expect(byId('admin-audit-error')).not.toBeNull();
    byId('admin-audit-retry')!.click();
    await settle();
    expect(byId('admin-audit-error')).toBeNull();

    fixture.destroy();
    TestBed.resetTestingModule();
    await create(vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }));
    expect(byId('admin-audit-retry')).toBeNull();
  });
});
