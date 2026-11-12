# STK Studio — regras do projeto (precedem o AGENTS.md do upstream)

Este repositório é o **STK Studio**, ADE corporativo construído sobre um snapshot do Orca (stablyai/orca, MIT). Veja `stk/docs/README.md`.

Leia também o `AGENTS.md` (comandos, estilo, design system, validação de UI). **Quando houver conflito, vale este arquivo.**

## Regras F2A

1. **Núcleo mínimo.** Features do STK Studio são **plugins** (sistema de plugins nativo, `docs/reference/plugin-*.md`) ou **serviços**. Mudança no núcleo do Orca só quando não houver alternativa. Toda mudança no núcleo entra em `stk/docs/patches.md` com justificativa e lista de arquivos tocados.
2. **Execução 100% local.** Não implementar nem depender de hosts remotos, SSH worktrees, VMs efêmeras, servidor/runtime remoto, relay ou mobile. O item "Remote hosts" e "Mobile" do `AGENTS.md` **não se aplica** às features F2A.
3. **Ponto único.** Dev e PO usam o mesmo app. Sem portais paralelos e sem servidor próprio novo. O estado compartilhado vive no repositório (`aidlc-docs/`) e no Jira.
4. **Sem dados ou credenciais corporativas.** Integrações (GitHub, Jira) com interfaces + implementações fake/mock para testes. Credenciais reais só via secrets do plugin, nunca em código, fixtures ou logs.
5. **Idioma.** UI do STK Studio em pt-BR. Código e identificadores em inglês.
6. **Publisher de plugin:** `stk` (nomes iniciados em `orca` são reservados).
7. Antes de push: `pnpm check:changed` (ou as verificações com escopo, reportando limites), e `pnpm validate:plugin` para plugins.
