---
name: project-spec003-decisoes-fase6-8
description: Decisões e desvios das Phases 6 a 8 da spec 003 que o William ainda precisa confirmar (WhatsApp marcado no vincular, rota /app/tag/:code, editar fora de app)
metadata:
  type: project
---

- **WhatsApp marcado no PIN do "Vincular tag" pelo app** (tela `V2-vincular-pin`, `decisoes-pivo` "as duas telas do PIN", contrato de `activate_tag`), embora a constituição diga "só nessa tela" (a de ativação). Reutiliza o `PinStep`. A confirmar com o William.
- **`/app/tag/:code`** (rota fora da tabela do contrato): o "Editar" da visão do dono só conhece o código (a projeção pública não traz id de pet); o app acha o pet em `my_dashboard`. A confirmar.
- **Editar pet** é rota de nível superior `app/pets/:petId/editar` (casca de fluxo, sempre clara), antes de `app`, e não filha de `app` como na tabela do contrato.
- Painel sem sino, sem "ninguém entrou em contato", sem o 3º cartão do desktop: o `my_dashboard` não traz esses dados. `X de 5` no lugar de "5 de 7".
- T073 foi marcada com a conferência por chamadas reais às RPCs no Supabase local (29 de 29), não por e2e de navegador contra o banco: o `environment.e2e.ts` ficou de fora por instrução. T074 (QA) cobre o navegador.

**Why:** a tela e o contrato divergem nesses pontos e a sessão principal precisa decidir.
**How to apply:** se o William responder, ajuste `PinStep` (WhatsApp), `RescueView.editHref` e `app.routes.ts` e apague este registro.
