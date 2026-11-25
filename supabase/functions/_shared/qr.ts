/**
 * QR Code da etiqueta (spec 003; contracts/label-rendering.contract.md): versao 3 (29 x 29), correcao de erro H, modo
 * alfanumerico, para a URL `HTTPS://TAGFARO.COM.BR/<CODIGO>` em maiusculas (32 caracteres). Nao ha outra configuracao: o
 * contrato fixa versao 3 e correcao H, e o codigo recusa texto que nao caiba.
 *
 * Uso nesta spec: ao criar um lote NOVO, `chooseMask` calcula a mascara pela regra de penalidade do padrao e ela e gravada
 * em `tag_codes.qr_mask` (a reimpressao usa a gravada, nunca recalcula). `encodeQr(texto, mascara)` monta a matriz com a
 * mascara pedida.
 *
 * STATUS DE VERIFICACAO (leia antes de confiar): a matriz e a escolha da mascara foram conferidas por testes de estrutura
 * (padroes de posicao, bits de formato com BCH, leitura de volta da URL e do Reed-Solomon a partir da matriz). Elas NAO foram
 * comparadas com o `segno` do script de referencia: isso e a T085 (bloqueada: faltam as mascaras do lote-001). A regra de
 * penalidade segue o texto do padrao (4 regras); se o `segno` desempatar ou arredondar a regra 4 de outro jeito, a T085
 * mostra e este arquivo se corrige antes de qualquer lote real. Nao use para gerar lote real antes disso.
 *
 * Modulo puro: sem rede, sem Deno.*, sem dependencias.
 */

export const QR_SIZE = 29;
const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const DATA_CODEWORDS = 26; // versao 3-H: 2 blocos de 13
const EC_PER_BLOCK = 22;
const BLOCKS = 2;
const FORMAT_ECC_H = 2; // bits de formato do nivel H

export type Modules = boolean[][]; // [y][x], true = escuro

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

/** Bytes de correcao de erro Reed-Solomon (22) de um bloco de dados. */
export function rsRemainder(data: readonly number[]): number[] {
  const divisor = rsDivisor(EC_PER_BLOCK);
  const result = new Array<number>(EC_PER_BLOCK).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < EC_PER_BLOCK; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

function dataCodewords(text: string): number[] {
  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  const idx = (i: number): number => {
    const k = ALNUM.indexOf(text[i]);
    if (k < 0) throw new Error("QR: caractere fora do modo alfanumerico");
    return k;
  };
  push(0b0010, 4);
  push(text.length, 9);
  for (let i = 0; i + 1 < text.length; i += 2) push(idx(i) * 45 + idx(i + 1), 11);
  if (text.length % 2 === 1) push(idx(text.length - 1), 6);
  const capacity = DATA_CODEWORDS * 8;
  if (bits.length > capacity) throw new Error("QR: texto nao cabe na versao 3 com correcao H");
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    bytes.push(b);
  }
  for (let pad = 0xec; bytes.length < DATA_CODEWORDS; pad ^= 0xec ^ 0x11) bytes.push(pad);
  return bytes;
}

/** Dados + correcao de erro, intercalados como manda o padrao. */
export function allCodewords(text: string): number[] {
  const data = dataCodewords(text);
  const per = DATA_CODEWORDS / BLOCKS;
  const blocks: number[][] = [];
  const ecs: number[][] = [];
  for (let b = 0; b < BLOCKS; b++) {
    const d = data.slice(b * per, (b + 1) * per);
    blocks.push(d);
    ecs.push(rsRemainder(d));
  }
  const out: number[] = [];
  for (let i = 0; i < per; i++) for (let b = 0; b < BLOCKS; b++) out.push(blocks[b][i]);
  for (let i = 0; i < EC_PER_BLOCK; i++) for (let b = 0; b < BLOCKS; b++) out.push(ecs[b][i]);
  return out;
}

function blank(): { modules: Modules; isFn: boolean[][] } {
  const grid = () => Array.from({ length: QR_SIZE }, () => new Array<boolean>(QR_SIZE).fill(false));
  return { modules: grid(), isFn: grid() };
}

function drawFormatBits(m: Modules, isFn: boolean[][], mask: number): void {
  const set = (x: number, y: number, dark: boolean) => {
    m[y][x] = dark;
    isFn[y][x] = true;
  };
  const data = (FORMAT_ECC_H << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(QR_SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, QR_SIZE - 15 + i, bit(i));
  set(8, QR_SIZE - 8, true); // modulo escuro fixo
}

function drawFunctionPatterns(m: Modules, isFn: boolean[][]): void {
  const set = (x: number, y: number, dark: boolean) => {
    m[y][x] = dark;
    isFn[y][x] = true;
  };
  for (let i = 0; i < QR_SIZE; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < QR_SIZE && y >= 0 && y < QR_SIZE) set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(QR_SIZE - 4, 3);
  finder(3, QR_SIZE - 4);
  // Alinhamento da versao 3: so o de (22, 22) (os outros cairiam sobre os padroes de posicao).
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  drawFormatBits(m, isFn, 0); // reserva a area
}

/** Quais modulos sao de funcao (padroes, temporizacao, formato): o resto leva dados. [y][x]. */
export function qrFunctionMap(): boolean[][] {
  const { modules, isFn } = blank();
  drawFunctionPatterns(modules, isFn);
  return isFn;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
    case 7: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
    default: throw new Error("QR: mascara fora de 0 a 7");
  }
}

function applyMask(m: Modules, isFn: boolean[][], mask: number): void {
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) if (!isFn[y][x] && maskBit(mask, x, y)) m[y][x] = !m[y][x];
  }
}

/** Penalidade do padrao (regras 1 a 4). Menor e melhor. */
export function qrPenalty(m: Modules): number {
  let score = 0;
  const lines: boolean[][] = [];
  for (let y = 0; y < QR_SIZE; y++) lines.push(m[y]);
  for (let x = 0; x < QR_SIZE; x++) lines.push(m.map((row) => row[x]));
  // Regra 1: sequencias de 5 ou mais modulos da mesma cor (3 + excesso), em linhas e colunas.
  // Regra 3: padrao 1:1:3:1:1 com 4 modulos claros de um dos lados (40 cada).
  const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const p2 = [...p1].reverse();
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= line.length; i++) {
      let a = true;
      let b = true;
      for (let k = 0; k < 11; k++) {
        const v = line[i + k] ? 1 : 0;
        if (v !== p1[k]) a = false;
        if (v !== p2[k]) b = false;
      }
      if (a) score += 40;
      if (b) score += 40;
    }
  }
  // Regra 2: blocos 2 x 2 da mesma cor (3 cada).
  for (let y = 0; y + 1 < QR_SIZE; y++) {
    for (let x = 0; x + 1 < QR_SIZE; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  }
  // Regra 4: 10 pontos por cada 5% de distancia de 50% de escuros.
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (QR_SIZE * QR_SIZE);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

function build(text: string, mask: number): Modules {
  const { modules, isFn } = blank();
  drawFunctionPatterns(modules, isFn);
  const words = allCodewords(text);
  let i = 0;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < QR_SIZE; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? QR_SIZE - 1 - vert : vert;
        if (!isFn[y][x] && i < words.length * 8) {
          modules[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
  applyMask(modules, isFn, mask);
  drawFormatBits(modules, isFn, mask);
  return modules;
}

/** Matriz do QR com a mascara pedida (0 a 7). */
export function encodeQr(text: string, mask: number): Modules {
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) throw new Error("QR: mascara fora de 0 a 7");
  return build(text, mask);
}

/** Mascara de menor penalidade (empate: a de menor numero). */
export function chooseMask(text: string): number {
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const score = qrPenalty(build(text, mask));
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
  }
  return best;
}
