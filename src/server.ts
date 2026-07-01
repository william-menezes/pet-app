/**
 * server.ts — SSR handler (Express + Angular Node App Engine).
 *
 * T020a: CSP estrita espelhada aqui (além de vercel.json).
 * - script-src: 'self' sem unsafe-inline/unsafe-eval.
 * - connect-src: 'self' + domínio Supabase (anon key/auth/realtime).
 * - style-src: 'self' 'unsafe-inline' (necessário para PrimeNG inline styles; o risco de
 *   XSS via CSS é baixo comparado a script — aceitável no MVP; revisar com nonce se necessário).
 * - font-src: 'self' (fontes Poppins/Inter são self-hosted ou importadas no bundle).
 * - img-src: 'self' data: blob:.
 * - frame-ancestors: 'none' (impede clickjacking).
 * - Sem unsafe-eval → bloqueia eval(), new Function() dinâmicos.
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

const browserDistFolder = join(import.meta.dirname, '../browser');

// Domínio do Supabase para o connect-src da CSP.
// Em prod, SUPABASE_URL deve ser definido como env var (não é segredo — é a URL pública).
const supabaseHost = process.env['SUPABASE_URL']
  ? new URL(process.env['SUPABASE_URL']).host
  : '*.supabase.co';

/**
 * Content-Security-Policy estrita (T020a).
 * Espelhada em vercel.json para a hospedagem de produção.
 * Sem unsafe-inline em script-src; sem unsafe-eval.
 */
const CSP = [
  `default-src 'self'`,
  `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `img-src 'self' data: blob: https:`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const app = express();
const angularApp = new AngularNodeAppEngine();

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
 * Injeta headers de segurança em todas as respostas SSR.
 * Inclui a CSP estrita (T020a) e outros headers de hardening.
 */
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  next();
});

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
