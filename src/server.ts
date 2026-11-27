/**
 * server.ts — SSR handler (Express + Angular Node App Engine).
 *
 * Cabeçalhos de segurança (T020a, T105): a CSP e os demais vêm de `src/security-headers.ts`, a fonte
 * única, também espelhada em vercel.json (`npm run check:headers` reprova divergência). Duas
 * políticas: `tag` (página de resgate) e `app` (todo o resto). O middleware vem ANTES dos arquivos
 * estáticos para que eles também saiam com os cabeçalhos.
 *
 * Nota: o domínio do Supabase (SUPABASE_URL) pode ser sobrescrito por env var.
 * Em dev: http://127.0.0.1:54321. Em prod: https://YOUR_PROJECT.supabase.co
 */
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { headerKindForPath, isHttpsRequest, securityHeaders } from './security-headers';
import { handleScanApi, SCAN_API_MAX_BODY, type ScanRoute } from './app/core/tags/server/scan-api';
import { readServerEnv } from './app/core/tags/server/server-env';

const browserDistFolder = join(import.meta.dirname, '../browser');

// Domínio do Supabase para o connect-src da CSP.
// Em prod, SUPABASE_URL deve ser definido como env var (não é segredo — é a URL pública).
const supabaseHost = process.env['SUPABASE_URL']
  ? new URL(process.env['SUPABASE_URL']).host
  : undefined;

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Cabeçalhos de segurança em TODA resposta (SSR e arquivos estáticos): por isso este middleware vem
 * antes do `express.static`. `upgrade-insecure-requests` e HSTS só quando o pedido chegou por HTTPS
 * (em localhost quebrariam a conversa com o Supabase local, que é HTTP).
 */
app.use((req, res, next) => {
  const https = isHttpsRequest(
    req.headers['x-forwarded-proto'],
    Boolean((req.socket as { encrypted?: boolean }).encrypted),
  );
  const headers = securityHeaders(headerKindForPath(req.path), { https, supabaseHost });
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  next();
});

/**
 * Registro de scan feito pelo navegador, depois da hidratação (T025/T104). A lógica está em
 * `core/tags/server/scan-api.ts` (testável sem o Express); aqui só se lê o corpo, com teto de 2 KB, e
 * se responde. A chave `FARO_SSR_KEY` vem de variável de ambiente do servidor e nunca sai daqui.
 */
const SCAN_ROUTES: Record<string, ScanRoute> = { '/api/scan': 'scan', '/api/scan/location': 'location' };

function readBody(req: express.Request, limit: number): Promise<Buffer | 'too_large'> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    let tooLarge = Number.isFinite(declared) && declared > limit;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) tooLarge = true;
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? 'too_large' : Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

app.post(Object.keys(SCAN_ROUTES), async (req, res) => {
  const route = SCAN_ROUTES[req.path];
  const body = await readBody(req, SCAN_API_MAX_BODY).catch(() => null);
  const result = await handleScanApi(
    {
      route,
      headers: {
        get: (name) => {
          const value = req.headers[name.toLowerCase()];
          return Array.isArray(value) ? value[0] : value;
        },
      },
      body,
    },
    { env: readServerEnv(process.env) },
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status);
  if (result.body === undefined) res.end();
  else res.json(result.body);
});

/** Qualquer outro método ou caminho em `/api`: sem corpo, sem cair na página "não encontrada". */
app.use('/api', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).end();
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
