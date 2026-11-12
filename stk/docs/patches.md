# Patches no núcleo do Orca

Toda mudança fora de `stk/plugins/` e `stk/docs/` que altere código do Orca entra aqui.

| # | Patch | Justificativa (por que não é plugin) | Arquivos tocados | Status |
|---|---|---|---|---|
| 1 | **Perfis de UI (Dev/PO)**: mecanismo genérico de visibilidade de UI por perfil, escolha de papel na primeira execução, troca em Configurações → Geral e painel inicial por perfil | Plugin só adiciona UI; não consegue esconder a barra lateral de workspaces, o workbench (terminais, editor, diffs) nem as abas nativas da barra direita, nem abrir um painel na inicialização. O mecanismo é único e reaproveitável pelo modo guiado (C11): um perfil é uma lista de superfícies ocultas + um painel inicial | Novos: `src/shared/ui-profiles.ts`, `src/renderer/src/components/profiles/{UiProfileHome.tsx,UiProfileFirstLaunchPicker.tsx,ui-profile-home-panel.ts,ui-profile-options.ts}`, `src/renderer/src/components/settings/general/UiProfileSetting.tsx`. Alterados: `src/shared/global-settings-types.ts` (campo `uiProfile`), `src/renderer/src/app-shell/use-app-chrome-layout.ts`, `src/renderer/src/app-shell/AppWorkspaceShell.tsx`, `src/renderer/src/app-shell/AppRootSurfaces.tsx`, `src/renderer/src/components/right-sidebar/right-sidebar-activity-visibility.ts`, `src/renderer/src/components/right-sidebar/use-right-sidebar-activity-items.ts`, `src/renderer/src/components/settings/general/GeneralPane.tsx`, `src/renderer/src/i18n/locales/{en,pt}.json` (chaves `stk.profile.*`). Testes: `src/shared/ui-profiles.test.ts`, `src/renderer/src/components/right-sidebar/right-sidebar-activity-visibility.test.ts` | PoC |

## Patch 1 — Perfis de UI

**Contrato.** `src/shared/ui-profiles.ts` define `UI_PROFILES`: cada perfil tem `hiddenSurfaces` (hoje `workspace-sidebar`, `workspace-workbench`, `right-sidebar-builtin-tabs`) e `homePanel` (plugin + painel, casado pelo id do manifesto, independente do publisher: `stk.aidlc` no catálogo ou `local.aidlc` em pasta de desenvolvimento). Novo papel = nova entrada; nova superfície = um valor em `UiSurface` + um `isUiSurfaceVisible` no ponto de render.

**Comportamento.**
- `settings.uiProfile` ausente → escolha de papel na primeira execução (diálogo, suprimido enquanto o onboarding do Orca está aberto). Ausente ou desconhecido é tratado como `dev`.
- Perfil é experiência, não permissão: o workbench fica **montado e oculto** (terminais e agentes continuam rodando); o que cada um grava é controlado por GitHub e Jira.
- PO: sem barra lateral esquerda; no centro, a página "Modo Product Owner" no lugar da Landing/workbench; barra direita só com abas de plugin (se não houver nenhuma, mantém as nativas, porque o resolvedor de aba exige ao menos um item); abre o painel `aidlc/inbox` uma vez por sessão, após a hidratação da UI.

**Rebase.** Pontos de conflito prováveis: `use-app-chrome-layout.ts` (cálculo de `workspaceChromeActive`/`showSidebar`), `ActivePage` em `AppWorkspaceShell.tsx` e o filtro de abas da barra direita. Todos com comentário `stk/docs/patches.md #1`.

**Limites conhecidos.** O título da janela, menus nativos, paleta de comandos e atalhos continuam disponíveis no modo PO (ex.: atalho de terminal flutuante). Esconder também esses pontos fica para o modo guiado (C11), usando o mesmo mecanismo.
