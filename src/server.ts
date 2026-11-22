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
