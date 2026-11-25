/**
 * PetService — T041 (spec 003)
 *
 * Pets do tutor: criar, editar, remover, listar e enviar a foto. Acesso direto às tabelas, protegido por RLS
 * (`tutor_id = auth.uid()`); só as colunas que o contrato concede (privilégio por coluna).
 *
 * Foto: redimensiona para 1600 px e converte para WebP no navegador, grava em
 * `pet-photos/<uid>/<pet>/<arquivo>.webp` e depois atualiza `pets.photo_path` (a restrição do banco exige que o
 * caminho comece pela pasta do tutor, por isso a ordem é criar o pet, subir a foto, gravar o caminho).
 *
 * Nenhuma mensagem do Supabase é exposta.
 */
import { Injectable, inject } from '@angular/core';

import type { Pet, PetSex, PetSize, PetSpecies } from '../../models';
import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import { PHOTO_PROCESSOR } from './image-resize';

export type PetError = 'invalid' | 'too_large' | 'unsupported' | 'not_found' | 'network';
export type PetResult<T> = ({ ok: true } & T) | { ok: false; error: PetError };

export interface PetDraft {
  name: string;
  species: PetSpecies;
  breed?: string | null;
  sex?: PetSex | null;
  size?: PetSize | null;
  neutered?: boolean | null;
  temperament?: string[];
  careNotes?: string | null;
}

export const PET_NAME_MAX = 40;
export const PET_BREED_MAX = 60;
export const PET_CARE_MAX = 280;
export const PET_TEMPERAMENT_MAX_ITEMS = 5;
export const PET_TEMPERAMENT_ITEM_MAX = 30;
/** Limite do bucket (migration 0035): 5 MiB. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 3600;

interface PetRow {
  id: string;
  tutor_id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex | null;
  size: PetSize | null;
  neutered: boolean | null;
  birth_month: string | null;
  temperament: string[] | null;
  care_notes: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
}

function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    size: row.size,
    neutered: row.neutered,
    birthMonth: row.birth_month,
    temperament: row.temperament ?? [],
    careNotes: row.care_notes,
    photoPath: row.photo_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const blankToNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Valida e monta só as colunas que o tutor pode gravar. `null` = dado inválido (a tela já valida; é a rede de segurança). */
export function toPetColumns(draft: Partial<PetDraft>, requireName: boolean): Record<string, unknown> | null {
  const cols: Record<string, unknown> = {};
  if (draft.name !== undefined || requireName) {
    const name = (draft.name ?? '').trim();
    if (name.length < 1 || name.length > PET_NAME_MAX) return null;
    cols['name'] = name;
  }
  if (draft.species !== undefined) {
    if (draft.species !== 'dog' && draft.species !== 'cat') return null;
    cols['species'] = draft.species;
  } else if (requireName) {
    return null;
  }
  if (draft.breed !== undefined) {
    const breed = blankToNull(draft.breed);
    if (breed !== null && breed.length > PET_BREED_MAX) return null;
    cols['breed'] = breed;
  }
  if (draft.sex !== undefined) cols['sex'] = draft.sex;
  if (draft.size !== undefined) cols['size'] = draft.size;
  if (draft.neutered !== undefined) cols['neutered'] = draft.neutered;
  if (draft.temperament !== undefined) {
    const items = draft.temperament.map((t) => t.trim()).filter((t) => t !== '');
    if (
      items.length > PET_TEMPERAMENT_MAX_ITEMS ||
      items.some((t) => t.length > PET_TEMPERAMENT_ITEM_MAX)
    ) {
      return null;
    }
    cols['temperament'] = items;
  }
  if (draft.careNotes !== undefined) {
    const care = blankToNull(draft.careNotes);
    if (care !== null && care.length > PET_CARE_MAX) return null;
    cols['care_notes'] = care;
  }
  return cols;
}

@Injectable({ providedIn: 'root' })
export class PetService {
  private readonly supabase = inject(SupabaseService);
  private readonly authStore = inject(AuthStore);
  private readonly processPhoto = inject(PHOTO_PROCESSOR);

  /** Pets do tutor, do mais antigo para o mais novo. */
  async list(): Promise<PetResult<{ pets: Pet[] }>> {
    try {
      const { data, error } = await this.supabase.client
        .from('pets')
        .select('*')
        .order('created_at', { ascending: true });
      if (error || !Array.isArray(data)) return { ok: false, error: 'network' };
      return { ok: true, pets: (data as PetRow[]).map(toPet) };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /** Um pet do tutor. Pet de outro tutor (a RLS não devolve a linha) ou inexistente: `not_found`. */
  async get(petId: string): Promise<PetResult<{ pet: Pet }>> {
    try {
      const { data, error } = await this.supabase.client.from('pets').select('*').eq('id', petId).maybeSingle();
      if (error) return { ok: false, error: 'network' };
      if (data === null) return { ok: false, error: 'not_found' };
      return { ok: true, pet: toPet(data as PetRow) };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  async create(draft: PetDraft): Promise<PetResult<{ petId: string }>> {
    const tutorId = this.authStore.user()?.id;
    const cols = toPetColumns(draft, true);
    if (tutorId === undefined || cols === null) return { ok: false, error: 'invalid' };
    try {
      const { data, error } = await this.supabase.client
        .from('pets')
        .insert({ ...cols, tutor_id: tutorId })
        .select('id')
        .single();
      const id = (data as { id?: unknown } | null)?.id;
      if (error || typeof id !== 'string') return { ok: false, error: 'network' };
      return { ok: true, petId: id };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  async update(petId: string, patch: Partial<PetDraft>): Promise<PetResult<object>> {
    const cols = toPetColumns(patch, false);
    if (cols === null) return { ok: false, error: 'invalid' };
    try {
      const { data, error } = await this.supabase.client.from('pets').update(cols).eq('id', petId).select('id');
      if (error) return { ok: false, error: 'network' };
      // RLS esconde pet de outro tutor: nenhuma linha atualizada.
      if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'not_found' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /** Remove o pet. Pet com tag ativa: quem chama faz `release_tag` antes, com confirmação. */
  async remove(petId: string): Promise<PetResult<object>> {
    try {
      const { error } = await this.supabase.client.from('pets').delete().eq('id', petId);
      return error ? { ok: false, error: 'network' } : { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /**
   * Envia a foto: processa, sobe para `pet-photos/<uid>/<pet>/<uuid>.webp`, grava `photo_path` e apaga a anterior
   * (melhor esforço). Devolve o caminho gravado.
   */
  async uploadPhoto(petId: string, file: Blob, previousPath: string | null = null): Promise<PetResult<{ path: string }>> {
    const tutorId = this.authStore.user()?.id;
    if (tutorId === undefined) return { ok: false, error: 'invalid' };

    let blob: Blob;
    try {
      blob = await this.processPhoto(file);
    } catch {
      return { ok: false, error: 'unsupported' };
    }
    if (blob.size > PHOTO_MAX_BYTES) return { ok: false, error: 'too_large' };

    const isJpeg = blob.type === 'image/jpeg';
    const path = `${tutorId}/${petId}/${crypto.randomUUID()}.${isJpeg ? 'jpg' : 'webp'}`;
    try {
      const storage = this.supabase.client.storage.from('pet-photos');
      const up = await storage.upload(path, blob, { contentType: isJpeg ? 'image/jpeg' : 'image/webp', upsert: false });
      if (up.error) return { ok: false, error: 'network' };
      const saved = await this.savePhotoPath(petId, path);
      if (!saved) {
        await storage.remove([path]);
        return { ok: false, error: 'network' };
      }
      if (previousPath !== null && previousPath !== path) {
        await storage.remove([previousPath]).catch(() => undefined);
      }
      return { ok: true, path };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  private async savePhotoPath(petId: string, photoPath: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('pets')
      .update({ photo_path: photoPath })
      .eq('id', petId)
      .select('id');
    return !error && Array.isArray(data) && data.length > 0;
  }

  /** URLs assinadas (1 h) das fotos, por caminho. Caminho que falhar fica de fora: a tela mostra o focinho. */
  async photoUrls(paths: readonly (string | null)[]): Promise<Record<string, string>> {
    const wanted = [...new Set(paths.filter((p): p is string => p !== null))];
    if (wanted.length === 0) return {};
    try {
      const { data, error } = await this.supabase.client.storage
        .from('pet-photos')
        .createSignedUrls(wanted, SIGNED_URL_SECONDS);
      if (error || !Array.isArray(data)) return {};
      const out: Record<string, string> = {};
      for (const row of data) {
        if (row.path && row.signedUrl && !row.error) out[row.path] = row.signedUrl;
      }
      return out;
    } catch {
      return {};
    }
  }
}
