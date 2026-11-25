// Fronteira da página pública no lint (spec 002, T047; contrato shells.contract.md §9).
// Passa um arquivo fictício de `src/app/features/public/` pela API do ESLint:
//  - para cada padrão proibido do contrato, um import que o casa (formas relativa e com alias)
//    tem de gerar erro `no-restricted-imports`;
//  - os imports permitidos não podem gerar nenhum erro dessa regra.
// Sai com código 1 se algo divergir. Sem dependências além do ESLint do projeto.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');

const PROBE = 'src/app/features/public/__probe__.ts';

// Padrões proibidos do contrato, com o caminho (a partir de `src/app/`) que cada um quer proteger.
const FORBIDDEN = [
  ...['auth', 'activation', 'pets', 'scans', 'account', 'admin', 'dev-gallery'].map((n) => `features/${n}`),
  'core/auth',
  'core/theme',
  ...['tutor-shell', 'admin-shell', 'flow-shell', 'screen-header', 'shell-fallback'].map((n) => `shared/shells/${n}`),
  ...['alert-dialog', 'sonner', 'sheet', 'dialog', 'popover', 'dropdown', 'select', 'tooltip'].map(
    (n) => `shared/components/${n}`,
  ),
];

const ALLOWED = [
  '@/shared/shells/public-layout/public-layout',
  '@/shared/components/faro/logo/logo',
  '@/shared/components/button',
  '@/shared/icons/faro-icons',
  '../../../shared/shells/public-layout/public-footer',
];

/** Formas de import que têm de ser barradas para um caminho protegido. */
function probesFor(path) {
  const forms = [`@/${path}/x`, `../../${path}/x`];
  // O import relativo curto entre irmãos (`../pets/x`) só existe dentro de features/.
  if (path.startsWith('features/')) forms.push(`../${path.slice('features/'.length)}/x`);
  return forms;
}

const eslint = new ESLint({ cwd: root });
const problems = [];

async function restrictedMessages(source) {
  const [result] = await eslint.lintText(source, { filePath: join(root, PROBE) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

let forbiddenChecked = 0;
for (const path of FORBIDDEN) {
  for (const specifier of probesFor(path)) {
    forbiddenChecked++;
    const messages = await restrictedMessages(`import { x } from '${specifier}';\nexport const y = x;\n`);
    if (messages.length === 0) problems.push(`import proibido NÃO foi barrado: '${specifier}'`);
  }
}

for (const specifier of ALLOWED) {
  const messages = await restrictedMessages(`import { x } from '${specifier}';\nexport const y = x;\n`);
  if (messages.length > 0) problems.push(`import permitido foi barrado: '${specifier}' (${messages[0].message})`);
}

if (problems.length > 0) {
  console.error('check:boundary: FALHOU');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:boundary: ok (${forbiddenChecked} imports proibidos barrados, ${ALLOWED.length} permitidos livres)`);
