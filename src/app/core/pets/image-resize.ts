import { InjectionToken } from '@angular/core';

/** Lado maior da foto do pet depois de redimensionada (T041). */
export const PHOTO_MAX_SIDE = 1600;

/** Recebe a foto escolhida e devolve o arquivo a enviar (WebP, até 1600 px). Rejeita se não for imagem. */
export type PhotoProcessor = (file: Blob) => Promise<Blob>;

/**
 * Redimensiona para no máximo 1600 px no lado maior e converte para WebP, no navegador. A orientação do EXIF é
 * respeitada (`createImageBitmap` aplica por padrão). O jsdom não tem canvas: os testes trocam este processador
 * pelo token `PHOTO_PROCESSOR`.
 */
export const resizeToWebp: PhotoProcessor = async (file) => {
  if (!file.type.startsWith('image/')) throw new Error('unsupported');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('unsupported');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (blob === null || blob.type !== 'image/webp') throw new Error('unsupported');
    return blob;
  } finally {
    bitmap.close();
  }
};

export const PHOTO_PROCESSOR = new InjectionToken<PhotoProcessor>('PHOTO_PROCESSOR', {
  providedIn: 'root',
  factory: () => resizeToWebp,
});
