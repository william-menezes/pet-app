# Specification Quality Checklist: Tag com QR Code

**Purpose**: validar a qualidade da especificação antes do planejamento técnico.
**Created**: 2026-11-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 Nenhum detalhe de implementação (linguagens, frameworks, bibliotecas, tabelas,
      endpoints) na spec. As únicas referências concretas são o formato do código e o domínio
      impresso, que são contrato de produto (Princípio VIII), não escolha técnica.
- [x] CHK002 Focada em valor para o usuário e necessidade do negócio.
- [x] CHK003 Escrita para leitores não técnicos, em PT-BR.
- [x] CHK004 Todas as seções obrigatórias preenchidas, sem placeholders.

## Requirement Completeness

- [x] CHK005 Nenhum `[NEEDS CLARIFICATION]` em aberto. As decisões da entrevista de 2026-11-21
      estão em "Clarifications"; as decisões tomadas pela própria spec estão listadas para revisão.
- [x] CHK006 Os requisitos funcionais (FR-001 a FR-073) são testáveis e sem ambiguidade.
- [x] CHK007 Os critérios de sucesso (SC-001 a SC-014) são mensuráveis.
- [x] CHK008 Os critérios de sucesso são agnósticos de tecnologia.
- [x] CHK009 Todos os cenários de aceite estão em Dado/Quando/Então.
- [x] CHK010 Casos de borda identificados (código inválido, concorrência, bloqueios, falha de
      e-mail, tag bloqueada, pet sem foto, troca de dono com modo perdido).
- [x] CHK011 Escopo delimitado, com "Out of Scope" explícito e as fronteiras com `002` e `004`.
- [x] CHK012 Dependências e premissas registradas em "Assumptions".

## Feature Readiness

- [x] CHK013 Cada história tem prioridade (P1 a P3) e teste independente.
- [x] CHK014 As histórias P1 (1 e 2) entregam valor sozinhas com o lote-001 importado.
- [x] CHK015 Cada requisito funcional tem ao menos um cenário de aceite ou caso de borda.
- [x] CHK016 Coerência com a constituição v2.0.0 verificada (ver "Constitution Check" no plano).
- [x] CHK017 Nomes de entidade seguem o glossário do `CLAUDE.md`.

## Pontos para o William revisar

> **Revisados pelo William em 2026-11-21.** Todos confirmados, com duas mudanças: REV007 (a opção
> começa marcada, com aviso) e REV012 (a tag mantém o PIN). REV011 foi resolvido com telas novas.

- [x] REV001 Scan só é registrado quando a página abre num navegador (não no carregamento pelo
      servidor). Evita avisos falsos de pré-visualização; quem fecha a página muito rápido pode
      não gerar aviso.
- [x] REV002 Limites do PIN: 5 erros/15 min por conta e tag; 20 erros/24 h por tag.
- [x] REV003 Segunda via por perda anula o código antigo na hora.
- [x] REV004 Foto do pet em armazenamento privado com endereço temporário (mais seguro, um pouco
      mais lento que um endereço fixo).
- [x] REV005 PIN de 6 caracteres mantido (cartões do lote-001 já definidos); avaliar 8 caracteres
      em lotes futuros.
- [x] REV006 Sem tabela de direitos de vínculo por enquanto; só a regra que hoje sempre permite.
- [x] REV007 **Alterado pelo William**: a opção de liberar o WhatsApp na tela do PIN começa
      **marcada**, com um aviso ao lado de que o número ficará disponível para quem escanear a tag
      e de onde desligar. A tela "Tag ativa" repete se ficou ligado. No servidor o padrão segue
      desligado: a tela envia a escolha de forma explícita.
- [x] REV008 A tela de ativação ganha esse controle, que não existe nas telas do canvas.
- [x] REV010 Endereços das telas (`contracts/integration-002-004.contract.md` §1). Novo pet e
      vincular tag ficam fora de `/app` (`/novo-pet`, `/vincular/<pet>`), porque usam a tela de
      fluxo, sem o menu do app.
- [x] REV011 As três telas que não tinham desenho ("Seus pets", fila de scans e auditoria do
      admin) foram desenhadas em 2026-11-21, a pedido do William.
- [x] REV012 **Alterado pelo William**: ao excluir a conta, a localização de **todos** os scans dos
      vínculos daquele tutor é apagada (ficam a hora e a contagem), e a tag volta a "não ativada"
      **com o mesmo PIN do cartão**: quem receber a tag com o cartão ativa sozinho. A mesma regra
      vale quando o tutor troca a tag de um pet. Risco aceito: o antigo dono ainda conhece um PIN
      válido até a próxima ativação.
- [x] REV013 A repetição de cliques dados antes de a página terminar de carregar foi desligada
      (conflita com a política de segurança do site). O botão de WhatsApp é um link e funciona
      mesmo assim.
- [x] REV009 Regra do dígito verificador **confirmada em 2026-11-21** com o script de referência e
      os 54 códigos do lote-001. O exemplo `7K3M-Q9XA-C` é válido.
