import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allCodewords, chooseMask, encodeQr, QR_SIZE, qrFunctionMap, qrPenalty, rsRemainder } from "./qr.ts";
import { tagUrl } from "./tag-code.ts";

const URL_TEXT = tagUrl("ABCDEFGHV"); // vetor sintetico valido
const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

// Leitor independente do QR, so para os testes: nao usa nada do codificador alem da matriz e do mapa de funcao.
function maskBit(mask: number, x: number, y: number): boolean {
  const f = [
    (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
    (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0,
    ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0, ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
  ];
  return f[mask];
}

function readFormat(m: boolean[][]): { first: number; second: number } {
  const b = (v: boolean) => (v ? 1 : 0);
  let first = 0;
  const pos1: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i++) pos1.push([8, i]);
  pos1.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) pos1.push([14 - i, 8]);
  pos1.forEach(([x, y], i) => (first |= b(m[y][x]) << i));
  let second = 0;
  const pos2: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) pos2.push([QR_SIZE - 1 - i, 8]);
  for (let i = 8; i < 15; i++) pos2.push([8, QR_SIZE - 15 + i]);
  pos2.forEach(([x, y], i) => (second |= b(m[y][x]) << i));
  return { first, second };
}

function bch(data5: number): number {
  let rem = data5;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data5 << 10) | rem) ^ 0x5412;
}

function readBack(m: boolean[][], mask: number): { data: number[]; ec: number[] } {
  const isFn = qrFunctionMap();
  const bits: number[] = [];
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < QR_SIZE; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? QR_SIZE - 1 - vert : vert;
        if (!isFn[y][x]) bits.push((m[y][x] !== maskBit(mask, x, y)) ? 1 : 0);
      }
    }
  }
  const words: number[] = [];
  for (let i = 0; i + 8 <= 70 * 8; i += 8) words.push(bits.slice(i, i + 8).reduce((a, v) => (a << 1) | v, 0));
  const data: number[] = [];
  const ec: number[] = [];
  for (let b = 0; b < 2; b++) {
    data.push(...Array.from({ length: 13 }, (_, i) => words[i * 2 + b]));
  }
  for (let b = 0; b < 2; b++) ec.push(...Array.from({ length: 22 }, (_, i) => words[26 + i * 2 + b]));
  return { data, ec };
}

function parseAlnum(data: number[]): string {
  const bits = data.flatMap((w) => Array.from({ length: 8 }, (_, i) => (w >>> (7 - i)) & 1));
  let p = 0;
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bits[p++];
    return v;
  };
  assertEquals(take(4), 0b0010, "modo alfanumerico");
  const len = take(9);
  let out = "";
  for (let i = 0; i + 1 < len; i += 2) {
    const v = take(11);
    out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
  }
  if (len % 2 === 1) out += ALNUM[take(6)];
  return out;
}

Deno.test("QR: tamanho 29 e padroes de posicao, temporizacao e modulo escuro fixo", () => {
  const m = encodeQr(URL_TEXT, 3);
  assertEquals(m.length, 29);
  assert(m.every((r) => r.length === 29));
  const finder = (ox: number, oy: number) => {
    for (let d = 0; d < 7; d++) {
      assert(m[oy][ox + d] && m[oy + 6][ox + d] && m[oy + d][ox] && m[oy + d][ox + 6], "borda do padrao de posicao");
    }
    assert(!m[oy + 1][ox + 1] && !m[oy + 1][ox + 5] && !m[oy + 5][ox + 1] && !m[oy + 5][ox + 5], "anel claro");
    assert(m[oy + 2][ox + 2] && m[oy + 3][ox + 3] && m[oy + 4][ox + 4], "miolo escuro");
  };
  finder(0, 0);
  finder(22, 0);
  finder(0, 22);
  for (let i = 8; i < 21; i++) assertEquals(m[6][i], i % 2 === 0, "temporizacao horizontal");
  for (let i = 8; i < 21; i++) assertEquals(m[i][6], i % 2 === 0, "temporizacao vertical");
  assert(m[21][8], "modulo escuro fixo");
  assert(m[22][22] && !m[21][21] && m[20][20], "padrao de alinhamento (22, 22)");
});

Deno.test("QR: bits de formato validos (BCH), as duas copias iguais, com nivel H e a mascara pedida", () => {
  for (let mask = 0; mask < 8; mask++) {
    const { first, second } = readFormat(encodeQr(URL_TEXT, mask));
    assertEquals(first, second, "copias iguais");
    const data5 = ((first ^ 0x5412) >>> 10) & 0x1f;
    assertEquals(data5 >>> 3, 2, "nivel H");
    assertEquals(data5 & 7, mask);
    assertEquals(bch(data5), first, "BCH confere");
  }
});

Deno.test("QR: ler a matriz de volta devolve a URL e o Reed-Solomon bate, para as 8 mascaras", () => {
  for (let mask = 0; mask < 8; mask++) {
    const { data, ec } = readBack(encodeQr(URL_TEXT, mask), mask);
    assertEquals(parseAlnum(data), URL_TEXT);
    assertEquals(ec.slice(0, 22), rsRemainder(data.slice(0, 13)));
    assertEquals(ec.slice(22), rsRemainder(data.slice(13)));
  }
});

Deno.test("QR: 70 codewords no total e resto Reed-Solomon de dados zerados e zero", () => {
  assertEquals(allCodewords(URL_TEXT).length, 70);
  assertEquals(rsRemainder(new Array(13).fill(0)), new Array(22).fill(0));
});

Deno.test("QR: chooseMask devolve a de menor penalidade (empate: a menor) e e deterministica", () => {
  const scores = Array.from({ length: 8 }, (_, m) => qrPenalty(encodeQr(URL_TEXT, m)));
  const best = chooseMask(URL_TEXT);
  assertEquals(scores[best], Math.min(...scores));
  assertEquals(best, scores.indexOf(Math.min(...scores)));
  assertEquals(chooseMask(URL_TEXT), best);
  assert(best >= 0 && best <= 7);
});

Deno.test("QR: entradas invalidas sao recusadas (mascara fora de 0 a 7, caractere fora do alfabeto, texto grande)", () => {
  assertThrows(() => encodeQr(URL_TEXT, 8));
  assertThrows(() => encodeQr(URL_TEXT, -1));
  assertThrows(() => encodeQr("minusculas", 0));
  assertThrows(() => encodeQr("A".repeat(40), 0));
});
