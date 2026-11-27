# Faro

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.14.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Variáveis do servidor SSR

Lidas só por `src/server.ts` e pelo código de servidor (`src/app/core/tags/server/`), com `process.env`. **Nunca** vão para o
navegador, para `environment*.ts` nem para o repositório: configure no painel da Vercel (ou no shell, em desenvolvimento).
Se alguma faltar, a página da tag cai na tela de contingência ("Este pet tem dono") e `POST /api/scan` responde `{ "owner": false }`:
o resgate nunca quebra por configuração.

| Variável | Para quê |
|---|---|
| `FARO_SSR_KEY` | Chave que o servidor do app manda no cabeçalho `x-faro-ssr-key` para as Edge Functions `resolve-tag` e `register-scan`. Mínimo de 32 caracteres; tem de ser igual à das funções. Rotação: ver `specs/003-tag-qr/quickstart.md`. |
| `IP_HASH_SECRET` | Segredo do HMAC-SHA256 que transforma o IP do visitante em `ip_hash`. O IP cru nunca sai do servidor do app. Mínimo de 32 caracteres. |
| `SUPABASE_FUNCTIONS_URL` | URL base das Edge Functions, sem barra final (ex.: `https://<projeto>.supabase.co/functions/v1`; local: `http://127.0.0.1:54321/functions/v1`). |
| `SUPABASE_URL` | Opcional. Só afina o `connect-src` da CSP para o host do projeto (ver `src/security-headers.ts`). |
