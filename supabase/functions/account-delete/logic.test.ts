import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isBucketMissing, isValidConfirm, removeFilesUnderPrefix, type StorageLike } from "./logic.ts";

// ── Confirmacao ─────────────────────────────────────────────────────────
Deno.test("confirm: so a palavra exata EXCLUIR vale", () => {
  assertEquals(isValidConfirm("EXCLUIR"), true);
  for (const ruim of ["excluir", "Excluir", " EXCLUIR", "EXCLUIR ", "EXCLUIR\n", "", "EXCLUA", null, undefined, 1, {}, ["EXCLUIR"]]) {
    assertEquals(isValidConfirm(ruim), false);
  }
});

// ── Cliente de storage falso ────────────────────────────────────────────
interface Fake extends StorageLike {
  removeCalls: string[][];
  listCalls: Array<{ path: string; offset: number }>;
}

/** `tree` mapeia uma pasta para as suas entradas; remover apaga do mapa, como o storage de verdade. */
function fakeStorage(
  tree: Record<string, Array<{ name: string; id: string | null }>>,
  opts: { listError?: { message?: string; status?: number } | null; removeError?: boolean } = {},
): Fake {
  const removeCalls: string[][] = [];
  const listCalls: Array<{ path: string; offset: number }> = [];
  return {
    removeCalls,
    listCalls,
    from() {
      return {
        list(path: string, o: { limit: number; offset: number }) {
          listCalls.push({ path, offset: o.offset });
          if (opts.listError) return Promise.resolve({ data: null, error: opts.listError });
          const all = tree[path] ?? [];
          return Promise.resolve({ data: all.slice(o.offset, o.offset + o.limit), error: null });
        },
        remove(paths: string[]) {
          removeCalls.push(paths);
          if (opts.removeError) return Promise.resolve({ data: null, error: { message: "falha" } });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}

function files(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `foto-${i}.jpg`, id: `id-${i}` }));
}

const UID = "11111111-2222-3333-4444-555555555555";

for (const [n, lotes] of [[0, []], [1, [1]], [100, [100]], [250, [100, 100, 50]]] as Array<[number, number[]]>) {
  Deno.test(`fotos: ${n} arquivos => ${lotes.length} remocoes de ${JSON.stringify(lotes)}`, async () => {
    const storage = fakeStorage({ [UID]: files(n) });
    const r = await removeFilesUnderPrefix(storage, "pet-photos", UID);
    assertEquals(r, { ok: true, removed: n });
    assertEquals(storage.removeCalls.map((c) => c.length), lotes);
    // Todos os caminhos ficam sob o prefixo da propria conta e nenhum se repete.
    const todos = storage.removeCalls.flat();
    assertEquals(todos.every((p) => p.startsWith(`${UID}/`)), true);
    assertEquals(new Set(todos).size, n);
  });
}

Deno.test("fotos: a listagem e paginada (100 por pagina, offset crescente)", async () => {
  const storage = fakeStorage({ [UID]: files(250) });
  await removeFilesUnderPrefix(storage, "pet-photos", UID);
  assertEquals(storage.listCalls.map((c) => c.offset), [0, 100, 200]);
});

Deno.test("fotos: bucket inexistente (404) => ok, nada removido", async () => {
  const storage = fakeStorage({}, { listError: { message: "Bucket not found", status: 404 } });
  assertEquals(await removeFilesUnderPrefix(storage, "pet-photos", UID), { ok: true, removed: 0 });
  assertEquals(storage.removeCalls.length, 0);
});

Deno.test("fotos: outro erro ao listar => falha (deletion_incomplete)", async () => {
  const storage = fakeStorage({}, { listError: { message: "internal", status: 500 } });
  assertEquals(await removeFilesUnderPrefix(storage, "pet-photos", UID), { ok: false });
});

Deno.test("fotos: erro ao remover => falha", async () => {
  const storage = fakeStorage({ [UID]: files(3) }, { removeError: true });
  assertEquals(await removeFilesUnderPrefix(storage, "pet-photos", UID), { ok: false });
});

Deno.test("fotos: desce em subpastas e remove so arquivos", async () => {
  const storage = fakeStorage({
    [UID]: [{ name: "pet-1", id: null }, { name: "capa.jpg", id: "x" }],
    [`${UID}/pet-1`]: [{ name: "a.jpg", id: "y" }, { name: "b.jpg", id: "z" }],
  });
  assertEquals(await removeFilesUnderPrefix(storage, "pet-photos", UID), { ok: true, removed: 3 });
  assertEquals(storage.removeCalls.flat().sort(), [`${UID}/capa.jpg`, `${UID}/pet-1/a.jpg`, `${UID}/pet-1/b.jpg`]);
});

Deno.test("fotos: barra final no prefixo nao duplica a barra", async () => {
  const storage = fakeStorage({ [UID]: files(1) });
  await removeFilesUnderPrefix(storage, "pet-photos", `${UID}/`);
  assertEquals(storage.removeCalls.flat(), [`${UID}/foto-0.jpg`]);
});

Deno.test("bucket inexistente: reconhece 404 e o texto, nao confunde com erro comum", () => {
  assertEquals(isBucketMissing({ status: 404 }), true);
  assertEquals(isBucketMissing({ statusCode: "404" }), true);
  assertEquals(isBucketMissing({ message: "Bucket not found" }), true);
  assertEquals(isBucketMissing({ message: "timeout", status: 500 }), false);
  assertEquals(isBucketMissing(null), false);
});
