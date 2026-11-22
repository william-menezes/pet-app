/**
 * Gera o seed das tags (spec 003-tag-qr, T020; contracts/integration-002-004.contract.md secao 6).
 *
 * Uso (na raiz do repositorio, Node 22.18 ou mais novo):
 *   node supabase/scripts/make-seed.ts
 *
 * O que faz:
 *  1. Gera seis codigos de TESTE com o modulo de codigo (`src/app/core/tag-code/tag-code.ts`): o do Paçoca e o
 *     vetor sintetico 7K3M-Q9XA-C (corpo 7K3MQ9XA + `checkDigit`); os outros cinco saem de `newCode` com uma fonte
 *     de bytes DETERMINISTICA (SHA-256 de um contador), para que rodar o script de novo nao mude nada. Nenhum
 *     codigo e escrito a mao e nenhum e codigo real do lote-001 (a lista real nao esta neste repositorio).
 *  2. Escreve SO o trecho entre `-- >>> 003-tag-qr (gerado; não edite à mão)` e `-- <<< 003-tag-qr` no fim de
 *     `supabase/seed.sql`. Se os marcadores nao existirem, os acrescenta no fim. Tudo fora deles fica byte a byte
 *     como estava (inclusive o tipo de quebra de linha do arquivo).
 *  3. Escreve `e2e/fixtures/seed-codes.json` com os codigos (fonte unica para testes e2e e para o quickstart).
 *
 * O que NAO faz: nao cria usuario (o tutor A, a "Ana", e o tutor B ja existem no seed da 001/004), nao altera
 * `perfis`, nao da pet nem tag ao tutor B.
 *
 * PIN (decisao do William, 2026-11-22): as tres tags `available` do seed (e so elas) recebem PINs DE
 * DESENVOLVIMENTO fixos, derivados por SHA-256 e gravados em `e2e/fixtures/seed-codes.json` (campo `devPins`), para
 * os testes de ponta a ponta ativarem sem pedir PIN ao admin. A regra "nenhum PIN em arquivo versionado" protege
 * PINs REAIS de tags impressas: estes pertencem a codigos sinteticos do `lote-900`, o seed so roda em banco local ou
 * de CI, e esses PINs nunca existem em producao. No banco continua so o hash bcrypt de custo 12. Os demais codigos
 * (vinculado, bloqueado, anulado) recebem um PIN aleatorio descartado, como antes.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { TAG_ALPHABET, checkDigit, format, isValid, newCode } from '../../src/app/core/tag-code/tag-code.ts';

const ROOT = resolve(import.meta.dirname ?? '.', '../..');
const SEED_FILE = resolve(ROOT, 'supabase/seed.sql');
const CODES_FILE = resolve(ROOT, 'e2e/fixtures/seed-codes.json');
const VECTORS_FILE = resolve(ROOT, 'src/app/core/tag-code/fixtures/tag-code.vectors.json');

const MARK_START = '-- >>> 003-tag-qr (gerado; não edite à mão)';
const MARK_END = '-- <<< 003-tag-qr';

/** Id do lote de teste. Segue o formato `lote-NNN` do banco; fora da faixa dos lotes reais (001, 002...). */
export const SEED_BATCH_ID = 'lote-900';
const TUTOR_A = '00000000-0000-0000-0000-000000000001';
const PET_PACOCA = '00000000-0000-0000-0000-0000000a0001';
const PET_MEL = '00000000-0000-0000-0000-0000000a0002';
const ASSIGNMENT_PACOCA = '00000000-0000-0000-0000-0000000b0001';

export interface SeedCodes {
  assigned: string;
  available: string;
  available2: string;
  available3: string;
  blocked: string;
  void: string;
}

/** Fonte de bytes deterministica: o n-esimo pedido devolve o SHA-256 de `faro-seed-v1:<n>`. */
function deterministicRandom(): (n: number) => Uint8Array {
  let counter = 0;
  return (n) => {
    const digest = createHash('sha256').update(`faro-seed-v1:${counter++}`).digest();
    return new Uint8Array(digest.subarray(0, n));
  };
}

export type DevPins = Record<'available' | 'available2' | 'available3', string>;

/** PIN de desenvolvimento (6 caracteres Crockford) derivado do nome do codigo. So para codigos sinteticos do seed. */
export function devPin(key: string): string {
  const digest = createHash('sha256').update(`faro-seed-pin-v1:${key}`).digest();
  let pin = '';
  for (let i = 0; i < 6; i++) pin += TAG_ALPHABET[digest[i] & 31];
  return pin;
}

export function makeDevPins(): DevPins {
  return { available: devPin('available'), available2: devPin('available2'), available3: devPin('available3') };
}

/** Os seis codigos do seed. Nunca repete um codigo, nem um vetor sintetico dos testes. */
export function makeSeedCodes(vectorCodes: ReadonlySet<string>): SeedCodes {
  const assigned = '7K3MQ9XA' + checkDigit('7K3MQ9XA');
  const random = deterministicRandom();
  const used = new Set<string>([assigned, ...vectorCodes]);
  const next = (): string => {
    for (;;) {
      const code = newCode(random);
      if (!used.has(code)) {
        used.add(code);
        return code;
      }
    }
  };
  return {
    assigned,
    available: next(),
    available2: next(),
    available3: next(),
    blocked: next(),
    void: next(),
  };
}

/** O trecho SQL entre os marcadores (sem os marcadores). So as tres tags `available` levam PIN de desenvolvimento. */
export function seedSql(codes: SeedCodes, pins: DevPins): string {
  const rows = [
    ['assigned', codes.assigned, 0, null],
    ['available', codes.available, 1, pins.available],
    ['available', codes.available2, 2, pins.available2],
    ['available', codes.available3, 3, pins.available3],
    ['blocked', codes.blocked, 4, null],
    ['void', codes.void, 5, null],
  ] as const;
  const values = rows
    .map(([status, code, mask, pin]) => `    ('${code}', '${status}', ${mask}, ${pin === null ? 'NULL::text' : `'${pin}'`})`)
    .join(',\n');
  return `-- Spec 003-tag-qr (T020). Gerado por supabase/scripts/make-seed.ts: nao edite a mao; rode o script.
-- Nao cria usuario nem mexe em perfis: a Ana e o tutor A (...0001), que a 001 e a 004 ja deixam pronto
-- (termos aceitos e celular confirmado). O tutor B (...0002) nao ganha pet nem tag.
-- PINs DE DESENVOLVIMENTO: as tres tags available abaixo trazem um PIN fixo para os testes de ponta a ponta. Sao PINs de
-- codigos SINTETICOS do lote-900; o seed so roda em banco local ou de CI e esses PINs nunca existem em producao. No banco
-- fica so o hash bcrypt de custo 12. Os outros codigos recebem um PIN aleatorio, descartado. PIN de tag impressa de
-- verdade nunca entra em arquivo versionado.
-- Os codigos sao de TESTE (vetores/derivados do modulo de codigo); nenhum e do lote-001. Seed nunca roda em producao.

INSERT INTO public.pets (id, tutor_id, name, species, breed, sex, size, neutered, temperament, care_notes)
VALUES
  ('${PET_PACOCA}', '${TUTOR_A}', 'Paçoca', 'dog', 'Vira-lata caramelo', 'male', 'medium', true,
   ARRAY['Dócil com pessoas', 'Medo de barulho'], 'Toma remédio para alergia de manhã. Não dar petisco sem perguntar.'),
  ('${PET_MEL}', '${TUTOR_A}', 'Mel', 'cat', 'Sem raça definida', 'female', 'small', true,
   ARRAY['Arisca com estranhos'], NULL);

-- Paçoca mostra o primeiro nome da Ana e o WhatsApp (ela tem celular confirmado); o resto vem dos padroes.
UPDATE public.rescue_profiles
   SET show_tutor_first_name = true, show_whatsapp = true
 WHERE pet_id = '${PET_PACOCA}';

INSERT INTO public.tag_batches (id, quantity, notes)
VALUES ('${SEED_BATCH_ID}', 6, 'Lote de teste do seed (so desenvolvimento)');

DO $seed$
DECLARE
  r record;
  v_pin text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
${values}
  ) AS t (code, status, qr_mask, dev_pin)
  LOOP
    v_pin := coalesce(r.dev_pin, public.new_activation_pin());
    INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
    VALUES (r.code, '${SEED_BATCH_ID}', r.status,
            extensions.crypt(v_pin, extensions.gen_salt('bf', 12)), r.qr_mask);
  END LOOP;
END;
$seed$;

-- Paçoca com a tag ativa desde 02 nov, e tres scans: um com GPS, um aproximado por IP e um sem localizacao.
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at)
VALUES ('${ASSIGNMENT_PACOCA}', '${codes.assigned}', '${PET_PACOCA}', '${TUTOR_A}', '2026-11-02 14:00:00-03');

INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, occurred_at, last_seen_at, ip_hash, geo_method,
                                lat, lng, accuracy_m, city, region, notified_at)
VALUES
  ('${codes.assigned}', '${ASSIGNMENT_PACOCA}', 'assigned', now() - interval '2 days', now() - interval '2 days',
   'seed-ip-hash-1', 'gps', -23.5614, -46.6559, 12, NULL, NULL, now() - interval '2 days'),
  ('${codes.assigned}', '${ASSIGNMENT_PACOCA}', 'assigned', now() - interval '9 days', now() - interval '9 days',
   'seed-ip-hash-2', 'ip', -23.5505, -46.6333, 3000, 'São Paulo', 'SP', now() - interval '9 days'),
  ('${codes.assigned}', '${ASSIGNMENT_PACOCA}', 'assigned', now() - interval '20 days', now() - interval '20 days',
   'seed-ip-hash-3', 'none', NULL, NULL, NULL, NULL, NULL, now() - interval '20 days');
`;
}

/** Troca o trecho entre os marcadores (ou o acrescenta no fim), preservando o EOL e tudo fora dos marcadores. */
export function applyToSeed(original: string, block: string): string {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const body = block.replace(/\r?\n/g, eol);
  const section = `${MARK_START}${eol}${body}${MARK_END}${eol}`;
  const start = original.indexOf(MARK_START);
  const end = original.indexOf(MARK_END);
  if (start >= 0 && end > start) {
    let after = end + MARK_END.length;
    // consome o fim de linha que pertencia ao marcador final
    if (original.startsWith('\r\n', after)) after += 2;
    else if (original.startsWith('\n', after)) after += 1;
    return original.slice(0, start) + section + original.slice(after);
  }
  if (start >= 0 || end >= 0) throw new Error('marcadores do seed incompletos: confira supabase/seed.sql');
  const sep = original.endsWith('\n') ? '' : eol;
  return `${original}${sep}${eol}${section}`;
}

function main(): void {
  const vectors = JSON.parse(readFileSync(VECTORS_FILE, 'utf8')) as { valid: { code: string }[] };
  const codes = makeSeedCodes(new Set(vectors.valid.map((v) => v.code)));
  for (const [key, code] of Object.entries(codes)) {
    if (!isValid(code)) throw new Error(`codigo gerado invalido (${key})`);
  }

  const seed = readFileSync(SEED_FILE, 'utf8');
  const pins = makeDevPins();
  const updated = applyToSeed(seed, seedSql(codes, pins));
  if (updated !== seed) writeFileSync(SEED_FILE, updated);

  const display = Object.fromEntries(Object.entries(codes).map(([k, c]) => [k, format(c)]));
  const json =
    JSON.stringify(
      {
        _: 'Gerado por supabase/scripts/make-seed.ts; nao edite a mao. Codigos de TESTE do seed (nenhum e do lote-001). devPins: PINs DE DESENVOLVIMENTO das tres tags available, de codigos sinteticos do lote-900; so existem em banco local ou de CI e nunca em producao. PIN de tag real nunca entra aqui.',
        batch: SEED_BATCH_ID,
        ...codes,
        display,
        devPins: pins,
      },
      null,
      2,
    ) + '\n';
  mkdirSync(dirname(CODES_FILE), { recursive: true });
  let current = '';
  try {
    current = readFileSync(CODES_FILE, 'utf8');
  } catch {
    current = '';
  }
  if (current !== json) writeFileSync(CODES_FILE, json);
  console.log(`seed das tags: ${Object.keys(codes).length} codigos, ${updated !== seed ? 'seed.sql atualizado' : 'seed.sql ja estava igual'}`);
}

// Só executa quando chamado como script (os testes importam as funcoes sem escrever arquivo).
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? '')) main();
