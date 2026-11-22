/**
 * Logica pura da Edge Function account-delete (contracts/account-delete.edge.md).
 * Os clientes entram por parametro (tipos estruturais: importar tipo de esm.sh quebra o `deno test` do CI).
 */

/** Campos aceitos no corpo (security-hardening.contract.md, secao 5): qualquer outro => 400 unknown_field. */
export const DELETE_ALLOWED_FIELDS = ["confirm", "password", "captcha_token"] as const;

/** Limite por conta de TODA chamada a esta funcao (security-hardening.contract.md, secao 2). Falha fechada. */
export const DELETE_CALLS_LIMIT = { bucket: "acct:delete:h", max: 10, window: 3600 } as const;

/** Passo 3: a palavra de confirmacao e exatamente "EXCLUIR" (sem trim, sem minusculas). */
export function isValidConfirm(confirm: unknown): confirm is "EXCLUIR" {
  return confirm === "EXCLUIR";
}

/** Bucket das fotos dos pets e tamanho do lote de remocao (passo 7). */
export const PHOTOS_BUCKET = "pet-photos";
export const REMOVE_BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 200; // teto de seguranca contra laco infinito (20.000 entradas por pasta)
const MAX_DEPTH = 3;

interface StorageError {
  message?: string;
  status?: number | string;
  statusCode?: number | string;
}
interface StorageEntry {
  name: string;
  id?: string | null;
}
/** Parte do cliente de storage que a remocao usa. */
export interface StorageLike {
  from(bucket: string): {
    list(
      path: string,
      options: { limit: number; offset: number },
    ): PromiseLike<{ data: StorageEntry[] | null; error: StorageError | null }>;
    remove(paths: string[]): PromiseLike<{ data: unknown; error: StorageError | null }>;
  };
}

export type RemoveResult = { ok: true; removed: number } | { ok: false };

/** Erro de "bucket inexistente" (404 ou texto "not found"): nao e falha, ha so o que remover (nada). */
export function isBucketMissing(error: StorageError | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.status ?? error.statusCode ?? "");
  if (code === "404") return true;
  return /bucket not found|not[_ ]found/i.test(String(error.message ?? ""));
}

/** Lista todos os arquivos sob `prefix` (paginando; entra em subpastas). `null` = erro de listagem. */
async function listAll(
  storage: StorageLike,
  bucket: string,
  prefix: string,
  depth: number,
): Promise<{ files: string[]; missing: boolean } | null> {
  const files: string[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) {
      if (isBucketMissing(error)) return { files: [], missing: true };
      return null;
    }
    const entries = data ?? [];
    for (const entry of entries) {
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null || entry.id === undefined) {
        // Pasta virtual: desce, ate o limite de profundidade.
        if (depth < MAX_DEPTH) {
          const inner = await listAll(storage, bucket, full, depth + 1);
          if (inner === null) return null;
          files.push(...inner.files);
        }
      } else {
        files.push(full);
      }
    }
    if (entries.length < LIST_PAGE_SIZE) return { files, missing: false };
    offset += entries.length;
  }
  return null; // passou do teto de paginas: nao arrisca dizer que terminou
}

/**
 * Passo 7: remove tudo sob `<prefix>/` em lotes de ate 100. Bucket inexistente => ok com 0.
 * Qualquer erro ao listar ou remover => `{ ok: false }` (o chamador responde `deletion_incomplete`).
 */
export async function removeFilesUnderPrefix(
  storage: StorageLike,
  bucket: string,
  prefix: string,
): Promise<RemoveResult> {
  const listed = await listAll(storage, bucket, prefix.replace(/\/+$/, ""), 0);
  if (listed === null) return { ok: false };
  if (listed.missing || listed.files.length === 0) return { ok: true, removed: 0 };

  let removed = 0;
  for (let i = 0; i < listed.files.length; i += REMOVE_BATCH_SIZE) {
    const batch = listed.files.slice(i, i + REMOVE_BATCH_SIZE);
    const { error } = await storage.from(bucket).remove(batch);
    if (error) return { ok: false };
    removed += batch.length;
  }
  return { ok: true, removed };
}
