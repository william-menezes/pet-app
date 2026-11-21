---
name: gotcha-zardui-ambiente-windows
description: Armadilhas de ambiente da spec 002 (Windows): ng test pelo Git Bash falha, barrel do @boxicons/js deixa os testes lentos
metadata:
  type: feedback
---

- `npm test -- --watch=false` rodado pelo Git Bash falha com "Vitest failed to find the runner" (cwd `d:/` minúsculo); pelo PowerShell (`D:\`) passa. **Why:** dois caminhos para o mesmo módulo vitest. **How to apply:** rodar `ng test`, build, lint e playwright pelo PowerShell; usar Bash só para sed/git.
- `import {...} from '@boxicons/js'` carrega 4.362 módulos e leva a suíte de 12 s para 86 s. **How to apply:** importar glifos por `@boxicons/js/icons/<Nome>` (como em `shared/icons/faro-icons.ts`).
- O `zard-cli` seletor do aviso é `z-sonner`, não `z-toaster`; vale o código copiado (regra 10 das tarefas).
