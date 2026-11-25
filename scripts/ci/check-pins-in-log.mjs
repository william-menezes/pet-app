// Gate (spec 003): nenhum PIN do pool do E2E real aparece nos logs das Edge Functions nem do servidor de producao.
// O pool (codigo/PIN) e gerado em tempo de execucao pelo global-setup do E2E e fica fora do repositorio; este script
// so le o arquivo temporario e procura cada PIN como palavra inteira nos logs informados.
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const poolFile = join(tmpdir(), 'faro-e2e-pool.json');
if (!existsSync(poolFile)) {
  console.error('pool do E2E ausente: nada para conferir (o E2E real nao rodou?)');
  process.exit(1);
}
const pool = JSON.parse(readFileSync(poolFile, 'utf8'));
let bad = 0;
let scanned = 0;
for (const log of process.argv.slice(2)) {
  if (!existsSync(log)) continue;
  scanned += 1;
  const text = readFileSync(log, 'utf8');
  for (const t of pool.tags) {
    if (new RegExp(`\b${t.pin}\b`).test(text)) {
      console.error(`::error::um PIN do pool apareceu em ${log}`);
      bad += 1;
    }
  }
}
if (scanned === 0) {
  console.error('nenhum log encontrado');
  process.exit(1);
}
if (bad > 0) process.exit(1);
console.log(`${pool.tags.length} PINs do pool: nenhum nos ${scanned} logs`);
