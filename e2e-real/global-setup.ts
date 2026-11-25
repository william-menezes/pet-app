import { readFileSync } from 'node:fs';

/**
 * Trava de seguranca: o E2E real so pode falar com um Supabase LOCAL. Aborta se E2E_SUPABASE_URL ou o
 * `environment.e2e.ts` apontarem para outro host.
 */
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i;

export default function globalSetup(): void {
  const url = process.env['E2E_SUPABASE_URL'] ?? '';
  if (!LOCAL.test(url)) {
    throw new Error('E2E real recusado: E2E_SUPABASE_URL ausente ou nao e local (127.0.0.1 ou localhost).');
  }
  let envFile = '';
  try {
    envFile = readFileSync('src/environments/environment.e2e.ts', 'utf8');
  } catch {
    throw new Error('E2E real recusado: src/environments/environment.e2e.ts nao existe (o workflow o gera no runner).');
  }
  const m = /supabaseUrl\s*:\s*['"]([^'"]+)['"]/.exec(envFile);
  if (!m || !LOCAL.test(m[1])) {
    throw new Error('E2E real recusado: environment.e2e.ts nao aponta para um Supabase local.');
  }
  if (/supabase\.co/i.test(envFile)) {
    throw new Error('E2E real recusado: environment.e2e.ts menciona supabase.co.');
  }
}
