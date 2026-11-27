---
name: gotcha-spec003-fase6-8
description: Armadilhas das Phases 6 a 8 da spec 003 (merge pelo PowerShell 5.1, viewChild com z-button, z-switch programático, settle de testes, overlay, câmera falsa)
metadata:
  type: feedback
---

- **Não regravar arquivo de merge pelo PowerShell 5.1** (`Get-Content` + `WriteAllText`): lê UTF-8 sem BOM como ANSI e grava mojibake ("PaÃ§oca"). Derrubou 3 checagens do `supabase-checks.sh` no CI. **How to apply:** resolva conflito com `git merge-file -p ours base theirs` e `sed` no Git Bash (bytes preservados), ou com Edit; confira com `grep -c "Ã"`.
- `node -e '...replace(/"/g, ...)'` num spec troca também as aspas duplas dos seletores (`[data-testid="x"]`) e quebra o arquivo. Use a ferramenta Edit. Heredoc `<<'EOF'` com `$localize` e crases às vezes falha com "unexpected EOF": escreva o script com a ferramenta Write e rode `node arquivo.mjs`.
- `viewChild('ref')` num elemento que também é componente ZardUI (`<button z-button #x>`) devolve a instância do componente, não o `ElementRef`: use `viewChild('x', { read: ElementRef })`.
- `z-switch`: `zChecked.set(v)` por código dispara `zCheckedChange` na hora. Desfazer um toque recusado com `set` virava um segundo toque; `SwitchRow.setChecked` tem um flag `silent` para não emitir `toggled`.
- Teste de componente com `load()` que encadeia várias promessas: `whenStable()` não espera. O `settle` precisa de `await new Promise(r => setTimeout(r, 0))` antes do `detectChanges`.
- O overlay do `z-alert-dialog` mora em `document.body` e fica mais um instante no DOM depois de fechar: teste com `document.querySelector` e não afirme "sumiu" logo depois.
- Playwright: `test.use({ launchOptions })` não vale dentro de `describe`; ponha no topo do arquivo. Câmera falsa: `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` e `permissions: ['camera']`.
- PATCH em `rescue_profiles` ligando WhatsApp ou telefone sem celular confirmado devolve HTTP 400 `{"code":"P0001","message":"phone_not_confirmed"}` (exceção do gatilho, não `{ok:false}`).
- A FK `tag_assignments.pet_id` é `ON DELETE SET NULL`: remover pet com tag ativa exige `release_tag` antes, senão sobra vínculo ativo sem pet.

**Why:** reunidas nas Phases 6 a 8 da spec 003 (2026-11-25).
**How to apply:** releia antes de mexer em interruptores, diálogos, leitor de QR ou de resolver um merge.
