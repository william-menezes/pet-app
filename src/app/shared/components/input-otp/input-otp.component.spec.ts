import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ZardInputOtpComponent } from './input-otp.component';
import { inputOtpSlotVariants, inputOtpVariants, type ZardInputOtpMode } from './input-otp.variants';

describe('ZardInputOtpComponent', () => {
  function render(mode: ZardInputOtpMode, label: string): ComponentFixture<ZardInputOtpComponent> {
    const fixture = TestBed.createComponent(ZardInputOtpComponent);
    fixture.componentRef.setInput('zMaxLength', 6);
    fixture.componentRef.setInput('zMode', mode);
    fixture.componentRef.setInput('zAriaLabel', label);
    fixture.detectChanges();
    return fixture;
  }

  function cells(fixture: ComponentFixture<ZardInputOtpComponent>): HTMLInputElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
  }

  function type(fixture: ComponentFixture<ZardInputOtpComponent>, text: string): void {
    const inputs = cells(fixture);
    [...text].forEach((char, index) => {
      inputs[index].value = char;
      inputs[index].dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
    });
    fixture.detectChanges();
  }

  it('o modo alfanumérico aceita K47Q9M (0-9 e A-Z)', () => {
    const fixture = render('alphanumeric', 'PIN de 6 caracteres');
    type(fixture, 'K47Q9M');
    expect(fixture.componentInstance.tokens().join('')).toBe('K47Q9M');
    expect(cells(fixture).map((c) => c.value).join('')).toBe('K47Q9M');
  });

  it('o modo alfanumérico aceita o PIN colado', () => {
    const fixture = render('alphanumeric', 'PIN de 6 caracteres');
    fixture.componentInstance.handlePaste('K47Q9M');
    fixture.detectChanges();
    expect(fixture.componentInstance.tokens().join('')).toBe('K47Q9M');
  });

  it('o PIN colado com hífen ou espaço não perde caractere (o corte em seis vem depois do filtro)', () => {
    for (const pasted of ['K47-Q9M', 'K47 Q9M', ' K47Q9M ', 'K4-7Q-9M', 'k47q9m'.toUpperCase(), 'K47Q9M123']) {
      const fixture = render('alphanumeric', 'PIN de 6 caracteres');
      fixture.componentInstance.handlePaste(pasted);
      fixture.detectChanges();
      expect(fixture.componentInstance.tokens().join(''), pasted).toBe('K47Q9M');
    }
  });

  it('colar no primeiro campo (autopreenchimento) com separador também preenche os seis', () => {
    const fixture = render('alphanumeric', 'PIN de 6 caracteres');
    const [first] = cells(fixture);
    first.value = 'K47-Q9M';
    first.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.tokens().join('')).toBe('K47Q9M');
  });

  it('o modo alfanumérico usa teclado de texto, letras maiúsculas e sem preenchimento automático', () => {
    const [first] = cells(render('alphanumeric', 'PIN de 6 caracteres'));
    expect(first.getAttribute('inputmode')).toBe('text');
    expect(first.getAttribute('autocapitalize')).toBe('characters');
    expect(first.getAttribute('autocomplete')).toBe('off');
  });

  it('o modo numérico rejeita letras e usa teclado numérico com one-time-code', () => {
    const fixture = render('numeric', 'Código de 6 dígitos');
    type(fixture, 'K');
    expect(fixture.componentInstance.tokens().join('')).toBe('');
    const [first] = cells(fixture);
    expect(first.value).toBe('');
    expect(first.getAttribute('inputmode')).toBe('numeric');
    expect(first.getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('o modo numérico aceita os 6 dígitos', () => {
    const fixture = render('numeric', 'Código de 6 dígitos');
    type(fixture, '482910');
    expect(fixture.componentInstance.tokens().join('')).toBe('482910');
  });

  it('são 6 células e o conjunto tem nome acessível', () => {
    const fixture = render('numeric', 'Código de 6 dígitos');
    expect(cells(fixture).length).toBe(6);
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Código de 6 dígitos');
  });

  it('não normaliza: O continua O (isso é de core/tag-code)', () => {
    const fixture = render('alphanumeric', 'PIN de 6 caracteres');
    type(fixture, 'O1IL2M');
    expect(fixture.componentInstance.tokens().join('')).toBe('O1IL2M');
  });
});

describe('inputOtp variants', () => {
  it('a grade tem 6 colunas e até 368px', () => {
    expect(inputOtpVariants().split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-6', 'gap-2', 'max-w-[368px]']));
  });

  it('a célula tem 60px, Outfit 26px semibold e as três bordas', () => {
    const classes = inputOtpSlotVariants().split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['h-[60px]', 'rounded-md', 'bg-card', 'font-display', 'text-[26px]', 'font-semibold', 'uppercase']),
    );
    expect(classes).toEqual(expect.arrayContaining(['border-[1.5px]', 'border-input']));
    expect(classes).toContain('data-filled:border-foreground');
    expect(classes).toContain('data-active:border-[2.5px]');
    expect(classes).toContain('data-active:border-foreground');
  });

  it('não usa anel nem borda primária', () => {
    expect(inputOtpSlotVariants()).not.toContain('ring');
    expect(inputOtpSlotVariants()).not.toContain('border-ring');
  });
});
