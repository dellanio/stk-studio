# STK AIDLC (`stk.aidlc`)

Plugin do STK Studio para o AI-DLC (C17–C19): painel do dev, Caixa de Entrada do PO e histórias → Jira. Perfil `trusted-worker`: o worker faz arquivos, git e rede; os painéis TSX não têm rede.

| Painel               | Para quem | O que faz                                                                                                                                                                               |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AIDLC**            | Dev       | Fases e etapas de `aidlc-state.md`, perguntas pendentes com formulário (A–E, múltipla escolha, X com texto livre), "Enviar ao PO", "Avisar o agente para reler", artefatos e delegações |
| **Caixa de Entrada** | PO        | Perguntas enviadas pelos devs em todos os projetos configurados, lidas e respondidas pela API do GitHub (sem clonar); status das fases; tokens                                          |
| **Histórias → Jira** | PO/Dev    | Revisão, edição e seleção das histórias do inception; "Lançar no Jira" cria épico (opcional) e histórias e grava as chaves no `stories.md`                                              |

Formatos suportados e suposições: [`stk/docs/aidlc-formatos.md`](../../docs/aidlc-formatos.md).

## Estrutura

```
src/domain/    parsers e writers puros (perguntas v1/v2, estado, histórias, delegações)
src/sources/   RecordFileSource: checkout local, API do GitHub, memória (demo) e servidor GitHub fake (testes)
src/stores/    QuestionStore, DelegationStore e "Lançar no Jira" sobre qualquer RecordFileSource
src/jira/      JiraClient: REST (Cloud v3 / Data Center v2) e fake
src/worker/    worker do plugin (handlers dos painéis, git, polling da Caixa de Entrada)
src/panels/    painéis TSX
fixtures/      registros de exemplo v1 (aidlc-docs/) e v2 (aidlc/spaces/...), usados em testes e no modo demonstração
```

## Desenvolvimento

Com o Orca/STK Studio rodando (`ORCA` = binário do app, ex.: `orca-dev`):

```bash
ORCA plugin types stk/plugins/aidlc            # tipos em .orca/types (ignorado pelo git)
ORCA plugin test stk/plugins/aidlc             # testes (node:test)
ORCA plugin check stk/plugins/aidlc --json     # renderiza cada painel nos cenários *.check.ts
pnpm validate:plugin stk/plugins/aidlc
ORCA plugin dev watch stk/plugins/aidlc --check   # instala como pasta de desenvolvimento (pede aprovação)
```

Na instalação por pasta, a identidade é `local.aidlc`; no catálogo F2A, o publisher vem do dono do repositório (`stk`).

## Configuração

Configurações → Plugins → STK AIDLC: seu nome, PO padrão, push automático, versão do formato, projetos do PO (`owner/repo@branch` por linha), URL da API do GitHub, intervalo de verificação, modo demonstração e campos do Jira. Tokens do GitHub e do Jira ficam nos **secrets do plugin** (aba Ajustes da Caixa de Entrada), nunca em configurações ou arquivos.

**Modo demonstração:** GitHub e Jira simulados em memória com dois projetos de exemplo (`demo/reembolso-v1@main`, `demo/reembolso-v2@main`, a partir de `fixtures/`). Nada sai da máquina; as respostas somem quando o worker reinicia.
