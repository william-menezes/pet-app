# Frontend Angular — Agent Memory Index

- [Project Structure & Key Paths](project-structure.md) — where core/, features/, shared/ live and what bootstrap created
- [Build & Lint Pitfalls](build-pitfalls.md) — common errors found and how they were resolved
- [Auth Feature Patterns](auth-patterns.md) — patterns used in 001-login: signals, guards, anti-enumeration
- [Prefira PrimeNG nativo](feedback-prefer-native-primeng.md) — usar componentes nativos antes de HTML/CSS custom; mapa de componentes + docs/primeng.md
- [Rótulo fora do input](feedback-rotulo-fora-do-input.md) — label acima/fora da caixa; não usar IftaLabel/FloatLabel
- [CSS layer: faro-ds vs primeng](gotcha-css-layer-primeng-vs-faro-ds.md) — regras unlayered vencem @layer primeng; cuidado com resets globais
- [ng test --no-watch](gotcha-ng-test-no-watch.md) — sem a flag o vitest trava em watch; nunca rodar ng serve p/ verificar
- [Variações de logo](reference-logo-variants.md) — quais SVGs em public/logos/ usar por tema/fundo
- [Pivô: ZardUI no lugar de PrimeNG](project-pivo-ui-zardui.md) — desde 2026-11-21; memórias de PrimeNG ficam obsoletas após a spec 002
- [Ambiente Windows na spec 002](gotcha-zardui-ambiente-windows.md) — ng test só pelo PowerShell; importar Boxicons por subcaminho
- [CSS e testes da spec 002](gotcha-zardui-css-e-testes.md) — camadas, ng-icon, toque de 44px, e2e em dev
- [Fase 4 da spec 002](gotcha-zardui-fase4-testes-e-capturas.md) — matchMedia no jsdom, Playwright apaga test-results, heredoc e regex
- [Host display vs hidden](gotcha-host-display-vs-hidden.md) — esconder por largura em div de embrulho; e2e de atalho espera hidratação
- [Fases 6 e 7 da spec 002](gotcha-spec002-fase6-7.md) — sem Python, sed come escapes, galeria em SSR no escuro, regras do check:ui
