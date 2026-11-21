# Segurança: o que só o William resolve nos painéis

As proteções que vivem no código estão nos contratos de endurecimento das specs
(`specs/004-conta-tutor/contracts/security-hardening.contract.md` e
`specs/003-tag-qr/contracts/security-hardening.contract.md`) e têm teste. Esta lista é o resto: o
que depende de conta, painel ou decisão. **A produção não abre com item obrigatório em aberto.**

## Obrigatório antes de abrir

### Cloudflare (desafio anti-robô)
- [ ] Criar a conta e um widget do Turnstile para `tagfaro.com.br` (modo "managed").
- [ ] Guardar a chave do site (vai no build do app) e a chave secreta (vai só no Supabase).

### Supabase (projeto de produção)
- [ ] Authentication › Bot and Abuse Protection: ligar o CAPTCHA, provedor Turnstile, chave secreta.
- [ ] Authentication › Rate Limits: os mesmos números de
      `specs/004-conta-tutor/contracts/auth-config.contract.md`.
- [ ] URL do site `https://tagfaro.com.br` e **só** `https://tagfaro.com.br/auth/callback` na lista
      de redirecionamento. Nenhum curinga, nenhum endereço de preview.
- [ ] Confirmação de e-mail ligada; provedores não usados desligados; entrada por telefone desligada.
- [ ] Segredos das funções definidos (`HASH_SALT`, `PHONE_OTP_PEPPER`, `FARO_SSR_KEY`,
      `IP_HASH_SECRET`), cada um gerado na hora, com 32 caracteres ou mais, nunca reaproveitado de
      desenvolvimento. `FARO_ENV=production`. Nenhuma variável `*_STUB_*`.
- [ ] SMTP próprio (`TODO(EMAIL_PROVIDER)`) e provedor de SMS (`TODO(SMS_PROVIDER)`).
- [ ] Backups: conferir a retenção do plano; ligar recuperação a um ponto no tempo se o plano tiver.
- [ ] Banco: exigir SSL; restringir o acesso direto por rede, se o plano permitir.

### Vercel
- [ ] Variáveis de ambiente marcadas como sensíveis; a `service_role` **não** existe na Vercel
      (só as Edge Functions a usam).
- [ ] **Proteção dos previews** ligada (Vercel Authentication): hoje os endereços de preview de
      `develop` e `homolog` são públicos.
- [ ] Firewall: regra de limite por IP em `/api/*`. **Não** ligar modo de desafio nem bloqueio de
      robôs na rota da tag (`/<código>`): quem achou um pet não pode cair num desafio.
- [ ] `tagfaro.com.br` com renovação automática, trava de transferência no registrador e um
      segundo contato de cobrança. Se o domínio expirar, todas as tags param.

### GitHub
- [ ] Verificação em duas etapas na conta.
- [ ] Secret scanning e push protection ligados (gratuitos em repositório público).
- [ ] Proteção de `master` e `homolog`: PR obrigatório, CI verde, sem push direto.
- [ ] Decidir: **tornar o repositório privado.** Hoje ele é público, com as specs de segurança, as
      telas e o histórico.

## Decisões pendentes

- [ ] **Segundo fator (TOTP) para contas de admin.** Recomendado: o admin gera lotes e reemite
      PINs. É funcionalidade nova, ainda sem spec.
- [ ] **HSTS com `preload`.** Mais forte, mas na prática irreversível.
- [ ] **Plano Pro do Supabase**: libera a recusa de senhas vazadas e o limite de sessões.
- [ ] O código do lote-001 que apareceu nas telas publicadas (ver `docs/decisoes-pivo.md`): tratar
      a tag como de teste, ou reescrever o histórico do git.

## Rotina

- Trocar `FARO_SSR_KEY` a cada 6 meses ou em qualquer suspeita (passo a passo no `quickstart.md` da
  `003`, depois da tarefa de rotação).
- Olhar a fila do admin: tags travadas em série e estouro de teto global são sinal de ataque.
- Aceitar os PRs do Dependabot depois do CI verde.
- `lote.csv` de cada lote novo: importar, conferir e apagar. Nunca por e-mail, nunca no git.
