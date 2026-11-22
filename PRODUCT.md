# Product

Faro é uma tag de coleira com QR Code que ajuda um pet perdido a voltar para casa.

## Platform

`web`. Um único web app responsivo (celular, tablet e desktop). Não há app nativo. A página da
tag é aberta pela câmera do celular de quem achou o pet.

## Stack

Angular 21 (signals, zoneless), ZardUI + Tailwind CSS v4, Boxicons v3. SSR nas rotas públicas,
CSR no app autenticado. Supabase (Postgres, Auth, Storage, Edge Functions). Vercel, domínio
`tagfaro.com.br`. Detalhe em `CLAUDE.md`.

## Users

- **Quem achou** — um estranho, na rua, com o pet de outra pessoa ao lado e o celular numa mão.
  Nunca ouviu falar do Faro. Pode estar no sol, com pressa e com rede ruim. Usa a página uma vez.
- **Tutor** — dono de cão ou gato no Brasil. Compra a tag, ativa em poucos minutos e quase não
  volta ao app, até o dia em que o pet some. Nesse dia está ansioso e precisa de clareza.
- **Admin** — os sócios. Geram lotes de códigos, imprimem etiquetas e dão suporte.

## Product Purpose

Reunir um pet perdido ao seu tutor. Quem acha escaneia a tag, vê quem é o pet e fala com o
tutor pelo WhatsApp em um toque. O tutor é avisado a cada leitura.

## Positioning

Uma tag física barata, sem bateria e sem app para instalar. Não é rastreador: não promete
localização em tempo real. Promete que quem achar o pet consegue falar com você.

## Operating Context

- A tag é impressa em 3D, com a etiqueta do QR selada em resina. O que está impresso não muda.
- O tutor compra a tag, escaneia e cai em "tag não ativada"; cria a conta, escolhe o pet e
  digita o PIN do cartão que veio na embalagem.
- O modelo de cobrança ainda não foi decidido (assinatura ou tag comprada). No MVP não há
  pagamento dentro do app.

## Capabilities and Constraints

**No MVP:** conta do tutor, cadastro mínimo do pet com foto, ativação e vínculo da tag com PIN,
página pública de resgate, modo perdido, registro de scans com localização e aviso por e-mail,
controle do que estranhos veem, gerenciar a tag (passar adiante, segunda via), painel admin
(lotes, etiquetas, códigos, vínculos, auditoria).

**Fora do MVP:** carteira de saúde e lembretes (fase 2), emergência, família e cuidadores, peso,
relatório para o veterinário, pagamento. Checagem de sintomas por IA é só uma ideia.

**Restrições que não cedem:**
- O QR nunca cai em erro. Toda tag abre uma página amigável.
- O resgate não depende de pagamento nem de limite de uso.
- Só aparece em público o que o tutor liberou. Dados mínimos: nome, e-mail, celular.
- Vincular uma tag exige o PIN.
- Código, endereço e domínio impressos não mudam nunca.

## Brand Commitments

- Ideia central e tagline: **"O caminho de volta para casa."**
- Voz acolhedora, calma e clara. Na página de resgate, quem fala é o pet, em primeira pessoa.
- No modo perdido: uma frase para a emoção, depois a instrução. Nunca alarmista.
- Botão diz o que faz: verbo + objeto.
- Vocabulário: tutor (não "dono" nem "usuário"), tag (não "dispositivo"), página de resgate,
  modo perdido, quem achou.
- Sem emoji na interface.

## Evidence on Hand

- Telas de referência: páginas "MVP v2" do canvas *Faro · Telas do MVP* (Claude Design), com cópia em `design/telas-v2/`. Direção aprovada em 12 telas-piloto; as demais ainda sem revisão do William.
- Design system: *Faro Design System* (Claude Design) e `DESIGN.md`.
- Decisões: `docs/decisoes-pivo.md`. Princípios: `.specify/memory/constitution.md` (v2.1.0).
- Logo: `public/logos/`. Um wordmark redesenhado em Outfit está a caminho.
- Foto do mascote das telas: o Paçoca, vira-lata caramelo.
- Ainda não há usuários reais nem dados de uso.

## Product Principles

1. **Dez segundos para quem achou.** A página de resgate se entende sem ler tudo.
2. **Resgate acima de tudo.** Nenhuma regra de negócio fica entre o pet e a volta para casa.
3. **O tutor decide o que aparece**, e vê a prévia antes de salvar.
4. **Todo estado termina num próximo passo.** Não há beco sem saída.
5. **Só a tag.** O que não ajuda o pet a voltar fica para depois.

## Accessibility & Inclusion

- Meta WCAG 2.1 AA: texto 4,5:1, controles e ícones 3:1, nos dois temas.
- A página de resgate é lida ao ar livre: tema claro fixo, texto de 16px ou mais, um botão grande.
- Alvos de toque de 44px ou mais. Foco sempre visível. Navegável por teclado.
- Funciona antes do JavaScript carregar e em rede lenta.
- PT-BR, com a arquitetura pronta para outros idiomas.
- Respeita `prefers-reduced-motion`.
