import { mergeApplicationConfig, ApplicationConfig, REQUEST, inject } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SERVER_TAG_RESOLVER } from './core/tags/tag-resolver.token';
import { createServerTagResolver } from './core/tags/server/server-tag-resolver';
import { readServerEnv } from './core/tags/server/server-env';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),

    // Resolvedor da página da tag: só existe no servidor (usa `process.env`, `node:crypto` e a chave
    // `FARO_SSR_KEY`). O pedido do navegador fornece o IP (pelos cabeçalhos da Vercel).
    {
      provide: SERVER_TAG_RESOLVER,
      useFactory: () =>
        createServerTagResolver({
          env: readServerEnv(process.env),
          headers: inject(REQUEST, { optional: true })?.headers ?? null,
        }),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
