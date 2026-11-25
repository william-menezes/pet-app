import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ZardSonnerService } from '@/shared/components/sonner';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminCodeDetail } from '../../../models';
import { AdminCodeDetailPage } from './code-detail';

const CODE = '7K3M-Q9XA-C';

const detail = (over: Partial<AdminCodeDetail> = {}): AdminCodeDetail => ({
  code: CODE,
  batchId: 'lote-900',
  status: 'assigned',
  createdAt: '2026-11-17T13:00:00Z',
  assignment: { id: 'a1', startedAt: '2026-11-02T21:40:00Z', petName: 'Paçoca', tutor: 'Ana S.' },
  history: [],
  scans: [{ id: 's1', occurredAt: '2026-11-25T14:32:00Z', statusAtScan: 'assigned', geoMethod: 'ip', accuracyM: null, city: 'São Paulo', region: 'SP', assignmentId: 'a1' }],
  pin: { used: true, usedAt: '2026-11-02T21:40:00Z', failCount24h: 0, lockedUntil: null },
  replacementRequests: [],
  ...over,
});

describe('AdminCodeDetailPage (T080)', () => {
  let fixture: ComponentFixture<AdminCodeDetailPage>;
  let el: HTMLElement;
  let admin: Record<'codeDetail' | 'setStatus' | 'reissuePin' | 'endAssignment' | 'resolveReplacement', ReturnType<typeof vi.fn>>;
  let sonner: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  const inDialog = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const clickEl = async (id: string) => {
    byId(id)!.click();
    await settle();
  };
  const clickDialog = async (id: string) => {
    inDialog(id)!.click();
    await settle();
  };

  async function create(over: Partial<typeof admin> = {}, d: AdminCodeDetail = detail()) {
    admin = {
      codeDetail: vi.fn().mockResolvedValue({ ok: true, detail: d }),
      setStatus: vi.fn().mockResolvedValue({ ok: true, status: 'blocked' }),
      reissuePin: vi.fn().mockResolvedValue({ ok: true, code: CODE, newPin: 'K47Q9M' }),
      endAssignment: vi.fn().mockResolvedValue({ ok: true, code: CODE, newPin: 'K47Q9M' }),
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
    fixture = TestBed.createComponent(AdminCodeDetailPage);
    fixture.componentRef.setInput('code', CODE);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  afterEach(() => {
    fixture?.destroy();
    document.querySelectorAll('.cdk-overlay-container > *').forEach((node) => node.remove());
  });

  it('mostra situação, vínculo, estado do PIN (nunca o valor), scans e histórico vazio', async () => {
    await create();
    expect(byId('admin-code-title')?.textContent).toContain(CODE);
    expect(byId('admin-code-status')?.textContent).toContain('Ativo');
    expect(byId('admin-code-meta')?.textContent).toContain('lote-900');
    expect(byId('admin-code-pet')?.textContent).toContain('Paçoca');
    expect(byId('admin-code-tutor')?.textContent).toContain('Ana S.');
    expect(byId('admin-code-pin-state')?.textContent).toContain('Usado em');
    expect(byId('admin-code-pin-state')?.textContent).toContain('tentativas erradas');
    expect(all('admin-code-scan')[0].textContent).toContain('Aproximada (IP)');
    expect(all('admin-code-scan')[0].textContent).toContain('São Paulo, SP');
    expect(byId('admin-code-history')?.textContent).toContain('Sem vínculos anteriores');
  });

  it('sem vínculo: mostra "Sem vínculo no momento" e desativa "Encerrar vínculo"', async () => {
    await create({}, detail({ status: 'available', assignment: null, pin: { used: false, usedAt: null, failCount24h: 2, lockedUntil: null } }));
    expect(byId('admin-code-no-assignment')).not.toBeNull();
    expect(byId('admin-code-pin-state')?.textContent).toContain('Ainda não usado');
    expect(byId('admin-action-end')?.hasAttribute('disabled')).toBe(true);
  });

  it('mais de dez scans: mostra dez e "Mostrar todos"', async () => {
    const scans = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      occurredAt: '2026-11-25T14:32:00Z',
      statusAtScan: 'assigned' as const,
      geoMethod: 'none' as const,
      accuracyM: null,
      city: null,
      region: null,
      assignmentId: 'a1',
    }));
    await create({}, detail({ scans }));
    expect(all('admin-code-scan')).toHaveLength(10);
    await clickEl('admin-code-scans-toggle');
    expect(all('admin-code-scan')).toHaveLength(12);
    expect(all('admin-code-scan')[0].textContent).toContain('Sem localização');
  });

  describe('ações', () => {
    it('bloquear: confirma com o código na pergunta e chama setStatus(blocked)', async () => {
      await create();
      await clickEl('admin-action-block');
      expect(inDialog('admin-confirm-title')?.textContent).toContain(`Bloquear ${CODE}?`);
      expect(admin.setStatus).not.toHaveBeenCalled();
      await clickDialog('admin-confirm-ok');
      expect(admin.setStatus).toHaveBeenCalledWith(CODE, 'blocked');
      expect(sonner.success).toHaveBeenCalledWith('Código bloqueado.');
      expect(admin.codeDetail.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('cancelar a confirmação não muda nada', async () => {
      await create();
      await clickEl('admin-action-void');
      await clickDialog('admin-confirm-cancel');
      expect(admin.setStatus).not.toHaveBeenCalled();
    });

    it('desbloquear aparece no lugar de bloquear quando o código está bloqueado', async () => {
      await create({}, detail({ status: 'blocked' }));
      expect(byId('admin-action-block')).toBeNull();
      await clickEl('admin-action-unblock');
      await clickDialog('admin-confirm-ok');
      expect(admin.setStatus).toHaveBeenCalledWith(CODE, 'available');
      expect(sonner.success).toHaveBeenCalledWith('Código desbloqueado.');
    });

    it('anular: texto "não dá para desfazer" com o código e chama setStatus(void)', async () => {
      await create();
      await clickEl('admin-action-void');
      expect(inDialog('admin-confirm-text')?.textContent).toContain(CODE);
      expect(inDialog('admin-confirm-text')?.textContent).toContain('Não dá para desfazer');
      await clickDialog('admin-confirm-ok');
      expect(admin.setStatus).toHaveBeenCalledWith(CODE, 'void');
    });

    it('trocar código (2ª via): anula e orienta a enviar tag nova', async () => {
      await create();
      await clickEl('admin-action-swap');
      expect(inDialog('admin-confirm-text')?.textContent).toContain('Envie uma tag nova');
      await clickDialog('admin-confirm-ok');
      expect(admin.setStatus).toHaveBeenCalledWith(CODE, 'void');
      expect(sonner.success).toHaveBeenCalledWith('Código anulado. Envie uma tag nova ao tutor.');
    });

    it('reemitir PIN só vale para tag disponível: com vínculo o botão fica desativado e diz por quê', async () => {
      await create();
      expect(byId('admin-action-reissue')?.hasAttribute('disabled')).toBe(true);
      expect(byId('admin-action-reissue')?.textContent).toContain('encerre o vínculo antes');
    });

    it('reemitir PIN: mostra o PIN novo uma vez e o apaga ao concluir', async () => {
      await create({}, detail({ status: 'available', assignment: null }));
      await clickEl('admin-action-reissue');
      await clickDialog('admin-confirm-ok');
      expect(admin.reissuePin).toHaveBeenCalledWith(CODE);
      expect(byId('admin-pin-reveal-pin')?.textContent?.trim()).toBe('K47Q9M');
      expect(byId('admin-pin-reveal')?.textContent).toContain('não aparece de novo');
      await clickEl('admin-pin-reveal-done');
      expect(byId('admin-pin-reveal')).toBeNull();
      expect(el.textContent).not.toContain('K47Q9M');
    });

    it('encerrar vínculo: pede o motivo, manda o motivo escolhido e mostra o PIN novo', async () => {
      await create();
      await clickEl('admin-action-end');
      expect(inDialog('admin-confirm-text')?.textContent).toContain(CODE);
      const lost = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="admin-confirm-reason"] button')].find((b) => b.textContent?.trim() === 'Tag perdida')!;
      lost.click();
      await settle();
      await clickDialog('admin-confirm-ok');
      expect(admin.endAssignment).toHaveBeenCalledWith(CODE, 'lost');
      expect(byId('admin-pin-reveal-pin')?.textContent?.trim()).toBe('K47Q9M');
    });

    it('encerrar vínculo sem escolher motivo usa "admin"', async () => {
      await create();
      await clickEl('admin-action-end');
      await clickDialog('admin-confirm-ok');
      expect(admin.endAssignment).toHaveBeenCalledWith(CODE, 'admin');
    });

    it('erro da operação fica na confirmação, com a mensagem, e nada de PIN aparece', async () => {
      await create({ endAssignment: vi.fn().mockResolvedValue({ ok: false, error: 'too_many_requests' }) });
      await clickEl('admin-action-end');
      await clickDialog('admin-confirm-ok');
      expect(inDialog('admin-confirm-problem')?.textContent).toContain('Muitas ações em pouco tempo');
      expect(byId('admin-pin-reveal')).toBeNull();
      expect(sonner.success).not.toHaveBeenCalled();
    });

    it('invalid_transition (ex.: desbloquear código anulado em outra aba) aparece como erro', async () => {
      await create({ setStatus: vi.fn().mockResolvedValue({ ok: false, error: 'invalid_transition' }) });
      await clickEl('admin-action-block');
      await clickDialog('admin-confirm-ok');
      expect(inDialog('admin-confirm-problem')?.textContent).toContain('não é permitida');
    });

    it('"Reimprimir QR" fica desativado enquanto as etiquetas estão bloqueadas', async () => {
      await create();
      expect(byId('admin-action-reprint')?.hasAttribute('disabled')).toBe(true);
      expect(byId('admin-action-reprint')?.textContent).toContain('Indisponível');
    });
  });

  it('código anulado: nenhuma ação, só a nota', async () => {
    await create({}, detail({ status: 'void', assignment: null }));
    expect(byId('admin-code-void-note')).not.toBeNull();
    expect(byId('admin-action-block')).toBeNull();
    expect(byId('admin-action-void')).toBeNull();
  });

  it('pedido de 2ª via aberto: "Marcar como resolvido" chama a RPC e relê', async () => {
    await create({}, detail({ replacementRequests: [{ id: 'r1', kind: 'damaged', status: 'open', createdAt: '2026-11-19T12:00:00Z', resolvedAt: null }] }));
    expect(byId('admin-code-request')?.textContent).toContain('Dano');
    await clickEl('admin-code-request-resolve');
    expect(admin.resolveReplacement).toHaveBeenCalledWith('r1', 'done');
    expect(sonner.success).toHaveBeenCalled();
  });

  it('PIN novo some quando o código da rota muda e quando a tela é destruída', async () => {
    await create({}, detail({ status: 'available', assignment: null }));
    await clickEl('admin-action-reissue');
    await clickDialog('admin-confirm-ok');
    expect(byId('admin-pin-reveal')).not.toBeNull();
    fixture.componentRef.setInput('code', '2FX8-CN73-F');
    await settle();
    expect(byId('admin-pin-reveal')).toBeNull();
    expect(el.textContent).not.toContain('K47Q9M');
  });

  it('código inexistente e inválido: "Não encontramos este código" com caminho de volta', async () => {
    await create({ codeDetail: vi.fn().mockResolvedValue({ ok: false, error: 'not_found' }) });
    expect(byId('admin-code-missing')).not.toBeNull();
    expect(byId('admin-code-missing-list')?.getAttribute('href')).toBe('/admin/codigos');
  });

  it('erro de rede tem "Tentar de novo"; forbidden não tem', async () => {
    await create({ codeDetail: vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, detail: detail() }) });
    expect(byId('admin-code-error')).not.toBeNull();
    await clickEl('admin-code-retry');
    expect(byId('admin-code-error')).toBeNull();

    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ codeDetail: vi.fn().mockResolvedValue({ ok: false, error: 'forbidden' }) });
    expect(byId('admin-code-retry')).toBeNull();
    expect(byId('admin-code-error')?.textContent).toContain('não tem acesso');
  });
});
