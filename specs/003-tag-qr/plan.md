# Implementation Plan: Tag com QR Code

**Branch**: `003-tag-qr` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-tag-qr/spec.md`

## Summary

Entrega o produto em si: a página pública da tag (resgate, não ativada, não encontrada), a ativação
com PIN, o app do tutor (painel, pet, visibilidade, modo perdido, scans, gerenciar tag), o registro
de scans com aviso por e-mail e o painel admin (lotes, etiquetas, códigos, fila, auditoria).

Abordagem: todo dado de tag vive no Postgres atrás de RLS deny-by-default. `anon` não lê tabela
nenhuma. A página pública é renderizada no servidor, que fala com duas Edge Functions protegidas
por uma chave compartilhada (`resolve-tag`, `register-scan`); o navegador nunca chama essas funções
direto. O tutor autenticado usa RPCs `security definer` para tudo que muda vínculo ou PIN. O código
da tag tem uma única implementação em TypeScript, compartilhada entre o app e as Edge Functions e
testada contra os códigos do lote-001.

## Technical Context

**Language/Version**: TypeScript 5.9 (Angular 21, Deno nas Edge Functions), SQL (Postgres 15, plpgsql)
**Primary Dependencies**: Angular 21 (standalone, signals, zoneless), `@angular/ssr` + Express,
ZardUI + Tailwind v4 (de `002`), `@supabase/supabase-js` 2, `pgcrypto`. Novas: uma biblioteca de
leitura de QR pela câmera carregada sob demanda (`BarcodeDetector` nativo, com `jsQR` como reserva),
Leaflet + OpenStreetMap carregados sob demanda no histórico de scans, e nas Edge Functions um
gerador de matriz QR com versão e máscara fixáveis e `pdf-lib` para o PDF das etiquetas.
**Storage**: Supabase Postgres (tabelas novas abaixo) e Supabase Storage (bucket privado `pet-photos`).
**Testing**: Vitest (app), `deno test` (Edge Functions e módulo de código), pgTAP via
`supabase test db` (RLS e RPCs), Playwright (e2e, incluindo sem JavaScript e com geolocalização).
**Target Platform**: Web. SSR na Vercel (`tagfaro.com.br`); Supabase gerenciado em São Paulo.
**Project Type**: web application (frontend Angular + backend Supabase no mesmo repositório).
**Performance Goals**: página de resgate com LCP ≤ 2,5 s e TTFB ≤ 600 ms em 4G lento (p90); JS da
rota pública ≤ 100 KB gzip; aviso de scan em ≤ 1 min (p95).
**Constraints**: contrato do Princípio VIII (código, URL, domínio, QR) imutável; sem overlay e sem
service worker na rota pública; tema claro fixo na página pública; segredos só no servidor.
**Scale/Scope**: primeiro lote de 54 tags; dimensionar para dezenas de milhares de códigos. 25 telas
em 3 larguras (mais 12 versões escuras), 9 tabelas novas, ~14 RPCs, 4 Edge Functions.

### Decisões de segurança concretas

| Tema | Decisão | Risco residual |
|---|---|---|
| Acesso anônimo | `anon` sem `GRANT` em nenhuma tabela ou RPC de tag. O SSR chama `resolve-tag` com `FARO_SSR_KEY`. | Vazamento da chave permite consultar códigos sem o limite por origem; mitigado por rotação e pelo limite global. |
| Anti-enumeração | Dígito verificador antes do banco; limite por `ip_hash` (30/min, 300/h); mesma resposta para inexistente, bloqueado e anulado. | Quem tem uma tag disponível em mãos descobre que ela existe (necessário para ativar). |
| PIN | `crypt(pin, gen_salt('bf', 12))`. Limites: 5 erros/15 min por conta+tag; 20 erros/24 h por tag. | Com o banco vazado, um PIN de 30 bits em bcrypt custo 12 ainda cai em dias por tag. Aceito; ver research §3. |
| Travamento malicioso | O limite de 15 min é por conta+tag, então um estranho não trava o dono. O limite de 24 h por tag exige 20 erros e avisa o admin. | Um atacante com várias contas confirmadas por SMS consegue travar uma tag por 24 h. |
| Scan falso | Scan só é gravado por chamada do navegador ao servidor do app (`POST /api/scan`), que repassa à Edge Function com a chave. Robôs de pré-visualização não executam esse passo. | Um script que imite o navegador gera scans; limitado por origem e deduplicado em 10 min. |
| Foto do pet | Bucket privado; a página pública recebe URL assinada de 1 hora gerada no servidor. | A URL assinada pode ser compartilhada enquanto vale. |
| IP | Guardado só como `ip_hash` (HMAC com segredo do servidor). | — |
| Pacote do lote | PINs em texto puro existem só na resposta do `admin-create-batch`; nada é gravado em claro nem em log. | Quem baixa o pacote precisa guardá-lo com cuidado; a tela avisa. |

## Constitution Check

*GATE: aprovado antes da pesquisa; reavaliar depois do desenho.*

### I. Rescue-First — NÃO-NEGOCIÁVEL — ✓ PASS
- `/:code` sempre termina em resgate, não ativada ou não encontrada; qualquer exceção no SSR ou nas
  Edge Functions cai na página de contingência (FR-013). Teste e2e derruba a função e confere.
- `resolve_tag` não consulta cobrança. `can_link_tag` só é chamada em `activate_tag`. Um teste
  estrutural falha se a função pública referenciar qualquer objeto de cobrança.
- Aviso de scan sem condição de pagamento (FR-049).
- Scans de tags bloqueadas, anuladas e não ativadas vão para a fila do admin (FR-053).

### II. Privacidade & LGPD — NÃO-NEGOCIÁVEL — ✓ PASS
- A projeção pública é montada no servidor a partir de `rescue_profiles`; campo desligado não sai do banco.
- Telefone e WhatsApp só ligam com celular confirmado (interface com `004`).
- `scan_events.assignment_id` isola scans por vínculo; a política de leitura passa pelo vínculo do tutor.
- Localização precisa só com consentimento do navegador; aproximada rotulada; IP só como hash.
- Prévia "como estranhos verão" antes de salvar (FR-037).
- Pendência registrada: janela de retenção de `scan_events` e `audit_log` (herdada, sem definição).

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL — ✓ PASS
- RLS habilitada na mesma migration de cada tabela; nenhuma política para `anon`.
- Mensagem única para inexistente/bloqueado/anulado; três respostas possíveis no total.
- PIN obrigatório, hash lento, limites, uso único, PIN novo ao liberar.
- Chaves de serviço, `FARO_SSR_KEY`, segredo do HMAC e credenciais de e-mail só em Edge Functions e
  no ambiente do servidor SSR.

### IV. Spec-Driven Development — ✓ PASS
- Spec sem stack; stack neste plano; tarefas em `tasks.md`. Implementação só após aprovação.

### V. Mobile-First, Performance & Acesso Universal — ✓ PASS
- Rota pública em SSR, sem overlay, tema claro, utilizável antes da hidratação (WhatsApp é `<a href>`).
- Três larguras em todas as telas; tema escuro só no app do tutor. Sem service worker.
- axe e orçamento de performance no CI para a rota pública.

### VI. Simplicidade & MVP-First — ✓ PASS
- Nada de planos, pagamento, saúde ou co-tutoria. `can_link_tag` é uma função que retorna `true`,
  sem tabela de entitlements (ver Complexity Tracking).
- Histórias independentes; P1 entrega valor sozinha com o lote-001 importado.

### VII. Observabilidade & Auditoria — ✓ PASS
- `audit_log` genérico com os eventos de FR-070; `scan_events` guarda situação da tag e se avisou.
- Falha de e-mail não derruba o scan; fila de reenvio simples por coluna `notified_at` nula.

### Suposições de hospedagem ainda não verificadas

O desenho da página pública supõe que, na Vercel com o preset do Angular: rotas próprias do servidor
Express funcionam, há variáveis de ambiente só do servidor e os cabeçalhos `x-vercel-ip-*` chegam à
rota. O `vercel.json` atual espelha a CSP, o que sugere que nem tudo passa pelo Express. **A tarefa
T024A verifica isso num deploy de preview e manda parar se falhar**; a alternativa é usar Vercel
Functions para `/api/scan` e para a chamada a `resolve-tag`.

### VIII. Contrato Físico Imutável — NÃO-NEGOCIÁVEL — ✓ PASS
- Um módulo de código (`tag-code`) com implementação única, usado pelo app e pelas Edge Functions,
  testado contra vetores sintéticos versionados e, localmente, contra os 54 códigos do lote-001.
  A variante do dígito verificador foi **confirmada em 2026-11-21** (research §2); nada que gere ou
  valide códigos reais vai para produção antes de T011 passar.
- `tag_codes.code` com `CHECK` de formato e gatilho que impede `UPDATE` do código e `DELETE` da linha.
- `qr_version` e `qr_mask` gravados por código; reimpressão usa esses valores.
- Nenhum domínio além de `tagfaro.com.br` em URL gerada; constante única, com teste.
- **Bloqueio conhecido**: o script chegou; faltam a fonte `JetBrainsMono-Bold.ttf` e as máscaras
  do lote-001. As tarefas de etiqueta (T084, T085) seguem bloqueadas; T011 foi desbloqueada.

## Project Structure

### Documentation (this feature)

```text
specs/003-tag-qr/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tag-code.contract.md          # formato, normalização, dígito verificador
│   ├── public-page.contract.md       # resolve-tag, register-scan, /api/scan, projeção pública
│   ├── tutor-rpcs.contract.md        # ativação, vínculo, pets, visibilidade, modo perdido, scans
│   ├── admin.contract.md             # lotes, etiquetas, códigos, fila, auditoria
│   ├── label-rendering.contract.md   # etiqueta e folha de impressão
│   └── rls-expectations.md           # matriz de acesso e testes obrigatórios
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── server.ts                                  # + rota POST /api/scan e /api/scan/location
├── app/
│   ├── app.routes.ts / app.routes.server.ts   # rotas e render mode
│   ├── core/
│   │   ├── tag-code/                          # normalize, isValid, format, checkDigit (+ fixtures)
│   │   ├── tags/                              # tag.service.ts (RPCs do tutor), public-tag.service.ts (SSR)
│   │   ├── pets/                              # pet.service.ts, rescue-profile.service.ts, photo upload
│   │   ├── scans/                             # scan.service.ts
│   │   └── admin/                             # admin-tag.service.ts
│   ├── features/
│   │   ├── public/tag-page/                   # resgate, modo perdido, visão do dono, não ativada, não encontrada, contingência
│   │   ├── activation/                        # escolher pet, PIN, sucesso; vincular pelo app (código, PIN)
│   │   ├── pets/                              # painel, página do pet, novo pet (2 passos), editar, visibilidade, modo perdido, gerenciar tag
│   │   ├── scans/                             # histórico
│   │   └── admin/                             # lotes, códigos, detalhe, fila, auditoria
│   └── models/                                # pet.ts, tag.ts, scan.ts, rescue-profile.ts
supabase/
├── migrations/                                # 0020 … 0034 (ver data-model.md)
├── functions/
│   ├── _shared/tag-code.ts                    # mesma fonte de core/tag-code (ver research §1)
│   ├── resolve-tag/
│   ├── register-scan/
│   ├── admin-create-batch/
│   └── admin-labels/
├── tests/                                     # pgTAP: rls_*.test.sql, rpc_*.test.sql
└── seed.sql                                   # dados de exemplo: Ana, Paçoca, Mel, tag 7K3M-Q9XA-C
tools/tag-generator/                           # referência em Python (a ser entregue pelo William)
docs/importar-lote-001.md                      # procedimento manual e único
e2e/                                           # tag-page.spec.ts, activation.spec.ts, scans.spec.ts, admin.spec.ts
```

**Structure Decision**: aplicação web única, com frontend em `src/` e backend em `supabase/`, como já
é o repositório. Pastas de feature conforme `CLAUDE.md`. `features/public/tag-page` não importa nada
de `features/activation`, `pets`, `scans`, `admin` nem de `core/auth` (regra de ESLint de `002`); a
detecção do dono é feita por um serviço mínimo em `core/tags` que só lê se existe sessão, sem
importar `core/auth` (`contracts/integration-002-004.contract.md` §5.2).

## Complexity Tracking

| Desvio | Por que é necessário | Alternativa mais simples rejeitada |
|---|---|---|
| Página pública fala com Edge Functions por meio do servidor SSR, com chave compartilhada, em vez de RPC direta com `anon` | O limite por origem precisa de um IP confiável; com RPC aberta a `anon`, quem chama escolhe o `ip_hash` e burla o limite | RPC `anon` com limite por parâmetro: enumeração sem freio real |
| Scan registrado por uma chamada do navegador (`/api/scan`) e não no próprio SSR | Robôs de pré-visualização e o próprio dono gerariam avisos falsos | Registrar no SSR: mais simples e funciona sem JS, mas avisa a cada link colado numa conversa |
| Bucket de fotos privado com URL assinada | A foto de um pet de uma tag desvinculada não pode continuar acessível por endereço fixo | Bucket público com nome aleatório: mais rápido, mas a URL nunca expira |
| Sem tabela de entitlements (o prompt do pivô sugeria uma) | Princípio VI: nada por antecipação; o modelo de cobrança não foi decidido | Criar a tabela vazia agora: estrutura que provavelmente será refeita |
| Etiqueta renderizada no backend, idêntica ao script | Exigência do contrato físico e da reimpressão idêntica | Continuar usando o script local: é o plano de contingência documentado, não o destino |
