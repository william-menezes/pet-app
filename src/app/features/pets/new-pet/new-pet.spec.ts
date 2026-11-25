import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { PetService } from '../../../core/pets/pet.service';
import { NewPet } from './new-pet';

describe('NewPet', () => {
  let fixture: ComponentFixture<NewPet>;
  let el: HTMLElement;
  let create: ReturnType<typeof vi.fn>;
  let uploadPhoto: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const text = () => el.textContent ?? '';
  const chip = (group: string, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>(`[data-testid="${group}"] button`)].find((b) => b.textContent?.trim() === label)!;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create$(returnUrl?: string) {
    create = vi.fn().mockResolvedValue({ ok: true, petId: 'p-novo' });
    uploadPhoto = vi.fn().mockResolvedValue({ ok: true, path: 'u/p/a.webp' });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PetService, useValue: { create, uploadPhoto } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewPet);
    el = fixture.nativeElement;
    if (returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.detectChanges();
    await settle();
  }

  async function type(id: string, value: string) {
    const input = byId(id) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function click(target: HTMLElement | null) {
    target!.click();
    await settle();
  }

  async function fillStep1(name = 'Paçoca') {
    await click(chip('new-pet-species', 'Cão'));
    await type('new-pet-name', name);
    await type('new-pet-breed', 'SRD');
    await click(chip('new-pet-sex', 'Macho'));
    await click(chip('new-pet-size', 'Médio'));
  }

  async function pickPhoto(file: File) {
    const input = byId('new-pet-photo-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: { item: () => file }, configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  describe('passo 1: dados (T044)', () => {
    it('mostra espécie, nome, raça, sexo e porte e "Passo 1 de 2"', async () => {
      await create$();
      expect(text()).toContain('Conte sobre seu pet');
      expect(byId('steps-text')?.textContent).toContain('Passo 1 de 2');
      for (const id of ['new-pet-species', 'new-pet-name', 'new-pet-breed', 'new-pet-sex', 'new-pet-size']) {
        expect(byId(id), id).not.toBeNull();
      }
    });

    it('Continuar sem nome nem espécie mostra os dois erros e não sai do passo', async () => {
      await create$();
      await click(byId('new-pet-continue'));
      expect(byId('new-pet-name-error')?.textContent).toContain('Diga o nome do seu pet.');
      expect(byId('new-pet-species-error')?.textContent).toContain('Escolha cão ou gato.');
      expect(byId('new-pet-name')?.getAttribute('aria-invalid')).toBe('true');
      expect(text()).toContain('Conte sobre seu pet');
    });

    it('nome só com espaços não vale; nome com mais de 40 letras não vale', async () => {
      await create$();
      await click(chip('new-pet-species', 'Gato'));
      await type('new-pet-name', '   ');
      await click(byId('new-pet-continue'));
      expect(byId('new-pet-name-error')).not.toBeNull();
      await type('new-pet-name', 'x'.repeat(41));
      expect(byId('new-pet-name-error')?.textContent).toContain('até 40');
    });

    it('com nome e espécie segue para o passo 2', async () => {
      await create$();
      await fillStep1();
      await click(byId('new-pet-continue'));
      expect(text()).toContain('O que ajuda num resgate');
      expect(byId('steps-text')?.textContent).toContain('Passo 2 de 2');
      expect(create).not.toHaveBeenCalled();
    });

    it('ao trocar de passo o foco vai para o título do passo novo', async () => {
      await create$();
      await fillStep1();
      await click(byId('new-pet-continue'));
      await settle();
      expect(document.activeElement?.tagName).toBe('H1');
      expect(document.activeElement?.textContent).toContain('O que ajuda num resgate');
    });

    it('voltar do passo 2 mantém o que foi digitado', async () => {
      await create$();
      await fillStep1('Mel');
      await click(byId('new-pet-continue'));
      await click(byId('flow-shell-back'));
      expect((byId('new-pet-name') as HTMLInputElement).value).toBe('Mel');
      expect(chip('new-pet-species', 'Cão').getAttribute('aria-pressed')).toBe('true');
      expect(chip('new-pet-size', 'Médio').getAttribute('aria-pressed')).toBe('true');
    });

    it('o fechar volta para o returnUrl (ou para o painel)', async () => {
      await create$('/ativar/7K3MQ9XAC');
      expect(byId('flow-shell-back')?.getAttribute('href')).toBe('/ativar/7K3MQ9XAC');
      TestBed.resetTestingModule();
      await create$('//evil.com');
      expect(byId('flow-shell-back')?.getAttribute('href')).toBe('/app');
    });
  });

  describe('passo 2: foto, jeito e cuidados (T045)', () => {
    beforeEach(async () => {
      await create$();
      await fillStep1();
      await click(byId('new-pet-continue'));
    });

    it('Salvar pet grava tudo, sobe a foto e volta para o painel', async () => {
      await pickPhoto(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
      expect(byId('new-pet-photo-button')?.textContent).toContain('Trocar foto');
      await click(chip('new-pet-temperament', 'Dócil com pessoas'));
      await click(chip('new-pet-temperament', 'Foge fácil'));
      await type('new-pet-care', 'Toma remédio para alergia.');
      await click(byId('new-pet-save'));
      expect(create).toHaveBeenCalledWith({
        name: 'Paçoca',
        species: 'dog',
        breed: 'SRD',
        sex: 'male',
        size: 'medium',
        temperament: ['Dócil com pessoas', 'Foge fácil'],
        careNotes: 'Toma remédio para alergia.',
      });
      expect(uploadPhoto).toHaveBeenCalledWith('p-novo', expect.any(File));
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });

    it('Pular por enquanto grava só o passo 1, sem foto nem jeito nem cuidados', async () => {
      await pickPhoto(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
      await type('new-pet-care', 'não deve ir');
      await click(byId('new-pet-skip'));
      const arg = create.mock.calls[0][0] as Record<string, unknown>;
      expect(arg).toEqual({ name: 'Paçoca', species: 'dog', breed: 'SRD', sex: 'male', size: 'medium' });
      expect(uploadPhoto).not.toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });

    it('arquivo que não é imagem é recusado com mensagem', async () => {
      await pickPhoto(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
      expect(byId('new-pet-photo-notice')?.textContent).toContain('Escolha uma imagem');
      expect(byId('new-pet-photo-button')?.textContent).toContain('Escolher foto');
    });

    it('"Outro" cria o jeito, já marcado, e respeita o limite de cinco', async () => {
      await click(byId('new-pet-custom-open'));
      await type('new-pet-custom-input', 'Adora água');
      await click(byId('new-pet-custom-add'));
      expect(chip('new-pet-temperament', 'Adora água').getAttribute('aria-pressed')).toBe('true');
      for (const label of ['Dócil com pessoas', 'Medo de barulho', 'Não gosta de gatos', 'Foge fácil']) {
        await click(chip('new-pet-temperament', label));
      }
      // cinco marcados: não cabe mais um "Outro"
      const open = byId('new-pet-custom-open') as HTMLButtonElement;
      expect(open.hasAttribute('disabled') || open.getAttribute('aria-disabled') === 'true').toBe(true);
    });

    it('cuidados acima de 280 mostram o erro e travam o Salvar', async () => {
      await type('new-pet-care', 'x'.repeat(281));
      expect(byId('new-pet-care-count')?.textContent).toContain('281/280');
      expect((byId('new-pet-save') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
    });

    it('falha ao criar: mensagem, fica no passo 2, e tentar de novo cria uma vez só', async () => {
      create.mockResolvedValueOnce({ ok: false, error: 'network' });
      await click(byId('new-pet-save'));
      expect(byId('new-pet-error')?.textContent).toContain('Não conseguimos salvar agora');
      expect(navigateByUrl).not.toHaveBeenCalled();
      await click(byId('new-pet-save'));
      expect(create).toHaveBeenCalledTimes(2);
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });

    it('foto que falha depois do pet salvo: tentar de novo só envia a foto; ou continuar sem ela', async () => {
      await pickPhoto(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
      uploadPhoto.mockResolvedValueOnce({ ok: false, error: 'network' });
      await click(byId('new-pet-save'));
      expect(byId('new-pet-error')?.textContent).toContain('O pet foi salvo, mas a foto não foi enviada');
      expect(navigateByUrl).not.toHaveBeenCalled();
      await click(byId('new-pet-retry'));
      expect(create).toHaveBeenCalledTimes(1);
      expect(uploadPhoto).toHaveBeenCalledTimes(2);
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });

    it('foto que falha: "Continuar sem a foto" segue sem enviar de novo', async () => {
      await pickPhoto(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
      uploadPhoto.mockResolvedValue({ ok: false, error: 'unsupported' });
      await click(byId('new-pet-save'));
      await click(byId('new-pet-continue-without-photo'));
      expect(uploadPhoto).toHaveBeenCalledTimes(1);
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });
  });

  describe('volta para onde veio', () => {
    it('com returnUrl da ativação, devolve o pet criado em ?pet=<id>', async () => {
      await create$('/ativar/7K3MQ9XAC');
      await fillStep1();
      await click(byId('new-pet-continue'));
      await click(byId('new-pet-skip'));
      expect(navigateByUrl).toHaveBeenCalledWith('/ativar/7K3MQ9XAC?pet=p-novo');
    });

    it('returnUrl externo é ignorado: vai para o painel', async () => {
      await create$('https://evil.com/x');
      await fillStep1();
      await click(byId('new-pet-continue'));
      await click(byId('new-pet-skip'));
      expect(navigateByUrl).toHaveBeenCalledWith('/app');
    });
  });
});
