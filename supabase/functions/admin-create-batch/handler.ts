/**
 * Orquestracao da Edge Function `admin-create-batch` (spec 003, T076; contracts/admin.contract.md; security-hardening
 * secao 5). Separada do `Deno.serve` para ser testavel com falsos.
 *
 * ATENCAO: so desenvolvimento ate a T011 passar com o lote-001 e a T085 conferir a mascara do QR contra o script de referencia
 * (ver `_shared/qr.ts`). Nao fazer deploy em producao nem gerar lote real antes disso.
 *
 * Fluxo: JWT de admin e `is_admin()` conferidos AQUI (`requireAdmin`); limite de 10 lotes por hora por admin (estouro: 429 e
 * evento de auditoria no banco); gera codigos (`newCode`) e PINs com fonte criptografica, calcula a mascara do QR de cada
 * codigo; `admin_hash_pins` calcula os hashes bcrypt custo 12 em fatias de 10 (3 em voo), sem gravar nada; `admin_insert_batch`
 * grava tudo numa transacao (so recebe hashes); colisao de codigo: troca so os codigos que colidiram (PIN e hash novos so para
 * eles) e repete, ate 5 rodadas; `admin_mark_package_downloaded` recusa o segundo pedido; responde o pacote em ZIP
 * (`Cache-Control: no-store`). Enquanto a etiqueta (T084) nao existe, o pacote tem so `pins.csv` (`codigo,pin`).
 *
 * Os PINs em claro existem so na memoria desta execucao e no corpo da resposta. Esta funcao NAO escreve log, e nada de PIN
 * vai para auditoria, tabela ou mensagem de erro.
 */
import { type AdminDeps, requireAdmin } from "../_shared/auth.ts";
import { allowedOriginsFromEnv, corsHeadersFor, withCors } from "../_shared/http.ts";
import { chooseMask } from "../_shared/qr.ts";
import { emptyResponse, internalError, jsonResponse, methodNotAllowed } from "../_shared/responses.ts";
import { format, newCode, TAG_ALPHABET, tagUrl } from "../_shared/tag-code.ts";
import { zipStore } from "../_shared/zip.ts";

export const BATCH_MAX_BODY = 1024;
export const BATCH_MAX_QUANTITY = 500;
export const BATCH_HOURLY_LIMIT = 10;
/** Rodadas de nova tentativa por colisao de codigo (contrato: ate 5 por codigo). */
export const COLLISION_ROUNDS = 5;
/** PINs por chamada de `admin_hash_pins` (o banco aceita ate 10; ~0,2 s cada, bem abaixo dos 8 s do PostgREST). */
export const HASH_SLICE = 10;
/** Fatias de hash em voo ao mesmo tempo. */
export const HASH_CONCURRENCY = 3;

export interface BatchDeps {
  admin: AdminDeps;
  /** RPC com a role de servico. */
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  /** Fonte criptografica (`crypto.getRandomValues`). */
  random(n: number): Uint8Array;
  now(): Date;
  /** Origens do navegador aceitas (CORS). Padrao: `ALLOWED_ORIGINS`. Lista vazia: nenhuma origem recebe o cabecalho. */
  allowedOrigins?(): string[];
}

/** Cabecalhos de resposta que a tela do admin le (nome do arquivo e id do lote). */
export const BATCH_EXPOSED_HEADERS = ["X-Batch-Id", "Content-Disposition"] as const;

type Rec = Record<string, unknown>;
interface Item {
  code: string;
  pin: string;
  /** bcrypt custo 12 de `pin`, calculado por `admin_hash_pins`. */
  pin_hash: string;
  qr_mask: number;
}

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** PIN de 6 caracteres do alfabeto Crockford; `byte & 31` e uniforme (256 e multiplo de 32). */
export function newPin(random: (n: number) => Uint8Array): string {
  const bytes = random(6);
  if (bytes.length < 6) throw new RangeError("fonte aleatoria devolveu bytes de menos");
  let pin = "";
  for (let i = 0; i < 6; i++) pin += TAG_ALPHABET[bytes[i] & 31];
  return pin;
}

function newItem(random: (n: number) => Uint8Array): Item {
  const code = newCode(random);
  return { code, pin: newPin(random), pin_hash: "", qr_mask: chooseMask(tagUrl(code)) };
}

/** Pede os hashes bcrypt em fatias de `HASH_SLICE`, `HASH_CONCURRENCY` ao mesmo tempo. false = alguma fatia falhou. */
async function hashItems(deps: BatchDeps, items: Item[]): Promise<boolean> {
  const slices: Item[][] = [];
  for (let i = 0; i < items.length; i += HASH_SLICE) slices.push(items.slice(i, i + HASH_SLICE));
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const slice = slices[next++];
      if (!slice) return;
      try {
        const res = await deps.rpc("admin_hash_pins", { p_pins: slice.map((it) => it.pin) });
        const hashes = res.data;
        if (res.error || !Array.isArray(hashes) || hashes.length !== slice.length || !hashes.every((h) => typeof h === "string" && h !== "")) {
          failed = true;
          return;
        }
        slice.forEach((it, i) => (it.pin_hash = hashes[i] as string));
      } catch {
        failed = true;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(HASH_CONCURRENCY, slices.length) }, worker));
  return !failed;
}

function fail(status: number, error: string): Response {
  return jsonResponse({ ok: false, error }, status);
}

/**
 * Unica funcao da 003 chamada direto pelo navegador (a tela do admin): responde o preflight e poe CORS em TODA resposta,
 * erro incluso. CORS nao autoriza nada: o JWT e `is_admin()` continuam exigidos no POST.
 */
export function createBatchHandler(deps: BatchDeps): (req: Request) => Promise<Response> {
  const inner = batchCore(deps);
  return async (req) => {
    const allowed = deps.allowedOrigins ? deps.allowedOrigins() : allowedOriginsFromEnv();
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeadersFor(req, allowed, BATCH_EXPOSED_HEADERS) });
    }
    return withCors(req, await inner(req), allowed, BATCH_EXPOSED_HEADERS);
  };
}

function batchCore(deps: BatchDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== "POST") return methodNotAllowed();

    const auth = await requireAdmin(req, deps.admin);
    if (!auth.ok) return auth.response;

    let quantity: number;
    let notes: string | null = null;
    try {
      const text = await req.text();
      if (text.length > BATCH_MAX_BODY) return fail(400, "invalid_input");
      const body: unknown = JSON.parse(text);
      if (!isRec(body)) return fail(400, "invalid_input");
      const q = body.quantity;
      if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > BATCH_MAX_QUANTITY) return fail(400, "invalid_input");
      quantity = q;
      if (body.notes !== undefined && body.notes !== null) {
        if (typeof body.notes !== "string" || body.notes.length > 200) return fail(400, "invalid_input");
        notes = body.notes;
      }
    } catch {
      return fail(400, "invalid_input");
    }

    try {
      // Limite por admin (10 por hora); o estouro grava o evento de auditoria no banco.
      const limit = await deps.rpc("admin_rate_hit", {
        p_admin: auth.userId,
        p_scope: "admin_batch_hour",
        p_limit: BATCH_HOURLY_LIMIT,
        p_window_seconds: 3600,
      });
      if (limit.error) return internalError();
      if (limit.data === true) return fail(429, "too_many_requests");

      // Gera os itens (codigos distintos) e grava; em colisao troca so os codigos que colidiram.
      const items: Item[] = [];
      const seen = new Set<string>();
      while (items.length < quantity) {
        const it = newItem(deps.random);
        if (seen.has(it.code)) continue;
        seen.add(it.code);
        items.push(it);
      }

      // O bcrypt custo 12 (~0,2 s por PIN) sai da gravacao: hashes em fatias pequenas, antes de qualquer escrita.
      // Falha em qualquer fatia: 500 sem gravar nada.
      if (!(await hashItems(deps, items))) return internalError();

      let batchId: string | null = null;
      for (let round = 0; round <= COLLISION_ROUNDS && batchId === null; round++) {
        const res = await deps.rpc("admin_insert_batch", {
          p_admin: auth.userId,
          p_quantity: quantity,
          p_notes: notes,
          p_items: items.map((it) => ({ code: it.code, pin_hash: it.pin_hash, qr_mask: it.qr_mask })),
        });
        if (res.error || !isRec(res.data)) return internalError();
        if (res.data.ok === true && typeof res.data.batch_id === "string") {
          batchId = res.data.batch_id;
        } else if (res.data.error === "code_collision" && Array.isArray(res.data.codes)) {
          const bad = new Set(res.data.codes.filter((c): c is string => typeof c === "string"));
          const replaced: Item[] = [];
          for (let i = 0; i < items.length; i++) {
            if (!bad.has(items[i].code)) continue;
            seen.delete(items[i].code);
            let it = newItem(deps.random);
            while (seen.has(it.code)) it = newItem(deps.random);
            seen.add(it.code);
            items[i] = it;
            replaced.push(it);
          }
          // So os itens trocados (PIN novo) precisam de hash novo; os demais reaproveitam o que ja foi calculado.
          if (!(await hashItems(deps, replaced))) return internalError();
        } else if (res.data.error === "batch_range_exhausted") {
          return fail(409, "batch_range_exhausted");
        } else {
          return internalError();
        }
      }
      if (batchId === null) return fail(500, "code_collision");

      // O pacote sai uma vez so: o banco recusa o segundo pedido.
      const mark = await deps.rpc("admin_mark_package_downloaded", { p_batch: batchId, p_admin: auth.userId });
      if (mark.error || !isRec(mark.data) || mark.data.ok !== true) return internalError();

      const csv = "code,pin\n" + items.map((it) => `${format(it.code)},${it.pin}`).join("\n") + "\n";
      const zip = zipStore([{ name: "pins.csv", data: new TextEncoder().encode(csv) }], deps.now());
      return new Response(zip, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${batchId}.zip"`,
          "Cache-Control": "no-store",
          "X-Batch-Id": batchId,
        },
      });
    } catch {
      return emptyResponse(500);
    }
  };
}
