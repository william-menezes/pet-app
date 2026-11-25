import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CAMERA_OPENER, QR_DECODER, QrScanner, cameraFailureOf, type CameraFailure } from './qr-scanner';

@Component({
  imports: [QrScanner],
  template: `<app-qr-scanner [intervalMs]="5" (detected)="found.push($event)" (failed)="failures.push($event)" />`,
})
class Host {
  readonly found: string[] = [];
  readonly failures: CameraFailure[] = [];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

function setup(opts: { opener: () => Promise<MediaStream | null>; texts?: (string | null)[]; decoderFails?: boolean }) {
  const texts = [...(opts.texts ?? [])];
  const decode = vi.fn(async () => (texts.length > 0 ? (texts.shift() as string | null) : null));
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CAMERA_OPENER, useValue: opts.opener },
      {
        provide: QR_DECODER,
        useValue: async () => {
          if (opts.decoderFails) throw new Error('sem decodificador');
          return { decode };
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, decode };
}

describe('QrScanner (T072)', () => {
  it('abre a câmera, lê um quadro por intervalo e emite cada texto lido', async () => {
    const { stream } = fakeStream();
    const { fixture, decode } = setup({ opener: async () => stream, texts: [null, 'https://x.test/a', null] });
    await fixture.whenStable();
    await wait(60);
    expect(fixture.componentInstance.found).toEqual(['https://x.test/a']);
    expect(decode.mock.calls.length).toBeGreaterThan(2);
    expect(fixture.componentInstance.failures).toEqual([]);
  });

  it('o mesmo QR no quadro seguinte não é emitido de novo em 2 s; outro texto é', async () => {
    const { stream } = fakeStream();
    const { fixture } = setup({ opener: async () => stream, texts: ['a', 'a', 'a', 'b'] });
    await fixture.whenStable();
    await wait(80);
    expect(fixture.componentInstance.found).toEqual(['a', 'b']);
  });

  it('permissão negada: emite "denied" uma vez e não tenta ler', async () => {
    const { fixture, decode } = setup({
      opener: async () => {
        throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
      },
    });
    await fixture.whenStable();
    await wait(30);
    expect(fixture.componentInstance.failures).toEqual(['denied']);
    expect(decode).not.toHaveBeenCalled();
  });

  it('sem câmera, sem suporte e erro qualquer: "unavailable"', async () => {
    const a = setup({ opener: async () => null });
    await a.fixture.whenStable();
    await wait(20);
    expect(a.fixture.componentInstance.failures).toEqual(['unavailable']);
    TestBed.resetTestingModule();
    const b = setup({
      opener: async () => {
        throw Object.assign(new Error('x'), { name: 'NotFoundError' });
      },
    });
    await b.fixture.whenStable();
    await wait(20);
    expect(b.fixture.componentInstance.failures).toEqual(['unavailable']);
  });

  it('decodificador que não carrega: "unavailable", e a câmera é desligada', async () => {
    const { stream, stop } = fakeStream();
    const { fixture } = setup({ opener: async () => stream, decoderFails: true });
    await fixture.whenStable();
    await wait(30);
    expect(fixture.componentInstance.failures).toEqual(['unavailable']);
    expect(stop).toHaveBeenCalled();
  });

  it('ao sair da tela, desliga a câmera e para de ler', async () => {
    const { stream, stop } = fakeStream();
    const { fixture, decode } = setup({ opener: async () => stream });
    await fixture.whenStable();
    await wait(30);
    fixture.destroy();
    const calls = decode.mock.calls.length;
    await wait(40);
    expect(stop).toHaveBeenCalled();
    expect(decode.mock.calls.length).toBe(calls);
  });

  it('sair antes de a câmera abrir também desliga a câmera que chegar depois', async () => {
    const { stream, stop } = fakeStream();
    let release: (s: MediaStream) => void = () => undefined;
    const opener = () => new Promise<MediaStream>((resolve) => (release = resolve));
    const { fixture } = setup({ opener });
    await fixture.whenStable();
    fixture.destroy();
    release(stream);
    await wait(10);
    expect(stop).toHaveBeenCalled();
  });
});

describe('cameraFailureOf', () => {
  it('permissão e política de segurança são "denied"; o resto é "unavailable"', () => {
    expect(cameraFailureOf({ name: 'NotAllowedError' })).toBe('denied');
    expect(cameraFailureOf({ name: 'SecurityError' })).toBe('denied');
    expect(cameraFailureOf({ name: 'NotFoundError' })).toBe('unavailable');
    expect(cameraFailureOf({ name: 'OverconstrainedError' })).toBe('unavailable');
    expect(cameraFailureOf(null)).toBe('unavailable');
  });
});
