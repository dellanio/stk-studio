# Formatos do AI-DLC suportados pelo plugin `stk/plugins/aidlc`

A versão do `aidlc-workflows` usada nos pilotos **não está confirmada**. O plugin tem adaptadores por versão e detecta o formato por arquivo; a configuração "Versão do formato AI-DLC" força um deles. Fontes: documentação oficial (https://awslabs.github.io/aidlc-workflows/) e as regras do repositório `awslabs/aidlc-workflows` nas tags `v1.0.1` (`aidlc-rules/aws-aidlc-rule-details/common/question-format-guide.md`, `inception/workflow-planning.md`, `inception/user-stories.md`) e `v2.11.3` (`core/aidlc-common/protocols/stage-protocol.md`, `stages/inception/user-stories.md`, fixtures `tests/fixtures/state-v7`).

## Onde fica o registro

| Layout | Raiz | Versões |
|---|---|---|
| `aidlc-docs` | `aidlc-docs/aidlc-state.md` | 0.x–1.x; 2.x "flat legacy" |
| `intent` | `aidlc/spaces/<space>/intents/<id>/aidlc-state.md` | 2.x (um registro por intenção) |

Delegações do STK ficam em `<raiz>/.stk/delegations.json` (para o layout `aidlc-docs`, `aidlc-docs/.stk/delegations.json`, como no brief).

## Perguntas (`*-questions.md`)

| | `aidlc-v1` (0.x–1.x) | `aidlc-v2` (2.x) |
|---|---|---|
| Cabeçalho | `## Question 1` + texto na linha seguinte | `## Q1. [trade] Título` (o `[trade]` existe a partir da 2.11) |
| Opções | `A) ...` separadas por linha em branco; "Other" é a última letra (pode ser `E)` ou `X)`) | `A. ...`; última é `X. Other (please specify)` |
| Múltipla escolha | "(select all that apply)" no texto | idem |
| Resposta gravada | `[Answer]: C` · múltipla `A, C` · outra `X) texto` | `[Answer]: B. <rótulo da opção>` · múltipla `A, C` · outra `X. texto` |

O parser é tolerante (aceita `##`–`####`, `Q1:`, `Question 1`, `A.`/`A)`, `**[Answer]:**`). Uma resposta vazia ou só com `_` conta como pendente. Blocos com `[Answer]:` e sem opções (ex.: `## Consolidated Summary Confirmation`) aparecem como pergunta de texto livre.

**Escrita.** Só a linha `[Answer]:` da pergunta muda; o resto do arquivo (incluindo finais de linha CRLF/LF) é preservado byte a byte. Testado em `src/domain/aidlc-questions.test.ts`.

**Suposições a confirmar.**
1. Para "Outra resposta", v1 grava `X) texto` e v2 `X. texto`. A documentação só diz "descreva após a tag".
2. Na v2, resposta única grava letra + rótulo (como nas fixtures do upstream); o protocolo também aceita só a letra.
3. Perguntas embutidas em arquivos de plano (`*-plan.md`, v1) não são lidas: o brief limita a `*-questions.md`.

## Estado (`aidlc-state.md`)

Fases por cabeçalho `### [emoji] <FASE> PHASE` (INITIALIZATION, IDEATION, INCEPTION, CONSTRUCTION, OPERATION/OPERATIONS). Etapas por checkbox na seção `## Stage Progress`:

- v1: `- [x] Requirements Analysis`, `- [ ] Application Design - EXECUTE`, `(SKIPPED)`/`(IN PROGRESS)` como nota.
- v2: `- [-] requirements-analysis — EXECUTE`, estados `[ ]` `[-]` `[?]` `[R]` `[x]` `[S]`.

`SKIP` não concluída conta como "não se aplica" e fica fora do percentual.

## Histórias (`inception/user-stories/stories.md`)

- v2 documenta `US{grupo}.{seq}` e critérios `AC{g}.{s}.{n}`; v1 deixa o formato livre.
- O adaptador reconhece histórias por cabeçalho (`##`–`#####`) com id `US1.1`, `US-001`, `Story 3` ou `História 3`; épicos por cabeçalho `Epic`/`Épico`; prioridade por `**Priority**:`; critérios pela seção/linha "Acceptance Criteria" (lista ou Given/When/Then).
- As chaves voltam como `Jira: PROJ-123` logo abaixo do cabeçalho da história e `Jira-Epic: PROJ-100` abaixo do título do documento. Uma chave existente é substituída, nunca duplicada; histórias com chave não são relançadas.
- Edições feitas na tela de revisão vão para o Jira, **não** são regravadas no `stories.md` (só a chave é).
