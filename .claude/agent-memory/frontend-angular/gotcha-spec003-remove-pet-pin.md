---
name: gotcha-spec003-remove-pet-pin
description: PIN novo do remover-pet fica numa seção da página; edição do pet é fluxo sempre claro; node -e com regex perde barras
metadata:
  type: project
---

`features/pets/remove-pet` mostra o PIN numa seção da página (não em `z-alert-dialog`, que fecha com Esc); foco e rolagem de novo em `(zAfterClose)`. O botão "Remover pet" some enquanto há PIN. O host (`new-pet`) é flow-shell: a seção entra no slot `[footer]`, que é fluxo normal (não fixo).

**Why:** o PIN novo é mostrado uma única vez. **How to apply:** todo PIN novo novo vai numa seção da página, nunca em overlay.

- A edição do pet é fluxo (sempre claro): e2e confere `.dark` ausente mesmo com preferência escura guardada (a classe `dark` fica em `app-tutor-shell`, não em `html`).
- Em edição, `my_dashboard` com falha agora é erro de carga (antes o pet abria sem a tag e remover não liberava a tag).
- `node -e` com template literal come `\/` de regex: use a ferramenta Edit para regex em specs.
- `npx ng test --no-watch` (não `npm test -- --watch=false`, que falha com "Unknown arguments" quando há caminho).
