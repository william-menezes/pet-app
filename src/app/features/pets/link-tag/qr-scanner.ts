import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Por que a câmera não serviu: permissão negada ou câmera/recurso ausente (sem HTTPS, sem câmera, sem suporte). */
export type CameraFailure = 'denied' | 'unavailable';

/** Lê o texto de um QR num quadro de vídeo. `null` quando não há QR no quadro. */
export interface QrDecoder {
  decode(video: HTMLVideoElement): Promise<string | null>;
}

/** Abre a câmera de trás (a tag fica na coleira, longe do rosto). `null` onde o navegador não tem câmera. */
export type CameraOpener = () => Promise<MediaStream | null>;

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => DetectorLike;

/**
 * Decodificador padrão: `BarcodeDetector` do navegador, quando existe; senão a biblioteca `jsQR`, baixada só agora
 * (por `import()`, num pedaço à parte: quem nunca escaneia nunca paga por ela).
 */
export async function createDefaultDecoder(): Promise<QrDecoder> {
  const Detector = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (Detector !== undefined) {
    try {
      const detector = new Detector({ formats: ['qr_code'] });
      return {
        async decode(video) {
          const found = await detector.detect(video);
          return found[0]?.rawValue ?? null;
        },
      };
    } catch {
      // formato não suportado neste aparelho: cai para o jsQR
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return {
    async decode(video) {
      if (context === null || video.videoWidth === 0) return null;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    },
  };
}

export const QR_DECODER = new InjectionToken<() => Promise<QrDecoder>>('QR_DECODER', {
  providedIn: 'root',
  factory: () => createDefaultDecoder,
});

export const CAMERA_OPENER = new InjectionToken<CameraOpener>('CAMERA_OPENER', {
  providedIn: 'root',
  factory: () => async () => {
    const devices = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
    if (devices === undefined || typeof devices.getUserMedia !== 'function') return null;
    return devices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  },
});

/** Mapeia o erro do `getUserMedia` para o motivo que a tela explica. */
export function cameraFailureOf(error: unknown): CameraFailure {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
}

/**
 * Leitor de QR por câmera (T072). Abre a câmera de trás, olha um quadro a cada `intervalMs` e emite o texto de cada QR
 * lido (o mesmo texto não se repete em 2 s). NÃO decide se o QR é do Faro: quem usa passa o texto por
 * `core/tag-code/qr-payload`. Falha (permissão negada, sem câmera, sem suporte) emite `failed` uma vez e para: a tela
 * cai em "Digitar código". Ao sair, desliga a câmera.
 */
@Component({
  selector: 'app-qr-scanner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block overflow-hidden rounded-2xl bg-ink' },
  template: `
    <video
      #video
      class="aspect-[4/3] w-full object-cover md:aspect-[16/9]"
      autoplay
      muted
      playsinline
      [attr.aria-label]="label"
      data-testid="qr-scanner-video"></video>
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <span class="size-[55%] rounded-3xl border-[3px] border-primary"></span>
    </div>
    @if (starting()) {
      <p class="absolute inset-x-0 bottom-3 text-center text-[13px] font-semibold text-ink-foreground" role="status" data-testid="qr-scanner-starting" i18n>
        Abrindo a câmera…
      </p>
    }
  `,
})
export class QrScanner {
  private readonly platform = inject(PLATFORM_ID);
  private readonly open = inject(CAMERA_OPENER);
  private readonly decoderFactory = inject(QR_DECODER);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  /** Intervalo entre quadros (ms). Existe para os testes. */
  readonly intervalMs = input(250);
  readonly detected = output<string>();
  readonly failed = output<CameraFailure>();

  protected readonly starting = signal(true);
  protected readonly label = $localize`Câmera para ler o QR da tag`;

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private lastText = '';
  private lastAt = 0;

  constructor() {
    if (!isPlatformBrowser(this.platform)) return;
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private async start(): Promise<void> {
    let stream: MediaStream | null;
    try {
      stream = await this.open();
    } catch (error) {
      this.fail(cameraFailureOf(error));
      return;
    }
    if (stream === null) {
      this.fail('unavailable');
      return;
    }
    if (this.stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const video = this.video().nativeElement;
    video.srcObject = stream;
    try {
      await video.play?.();
    } catch {
      // o autoplay já cuida de tocar
    }
    let decoder: QrDecoder;
    try {
      decoder = await this.decoderFactory();
    } catch {
      this.fail('unavailable');
      return;
    }
    this.starting.set(false);
    this.schedule(decoder);
  }

  private schedule(decoder: QrDecoder): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(decoder), this.intervalMs());
  }

  private async tick(decoder: QrDecoder): Promise<void> {
    if (this.stopped) return;
    try {
      const text = await decoder.decode(this.video().nativeElement);
      const now = Date.now();
      if (text !== null && text !== '' && !this.stopped && (text !== this.lastText || now - this.lastAt > 2000)) {
        this.lastText = text;
        this.lastAt = now;
        this.detected.emit(text);
      }
    } catch {
      // quadro ruim: tenta o próximo
    }
    this.schedule(decoder);
  }

  private fail(reason: CameraFailure): void {
    this.stop();
    this.starting.set(false);
    this.failed.emit(reason);
  }

  private stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
