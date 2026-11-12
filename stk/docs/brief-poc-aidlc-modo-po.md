# Brief — PoC 1: AIDLC + perfis/modo PO + histórias → Jira (C17–C19)

> Leia antes: `CLAUDE.md` (regras F2A), `stk/docs/premissas-e-capacidades.md` (seções 1, 2, 4.8 e 5) e `docs/reference/plugin-*.md` (sistema de plugins do Orca).

## 1. Problema

Nos pilotos de AIDLC (AWS `awslabs/aidlc-workflows`), o time se reúne, grava e transcreve a ideação, e passa a transcrição ao workflow. **Quem digita no CLI todas as respostas às perguntas do workflow é o dev**, inclusive as que só o PO sabe responder. Dúvidas que surgem depois, sem o PO por perto, se perdem no Teams. As histórias geradas são copiadas e coladas manualmente no Jira.

## 2. Fato técnico que viabiliza o PoC

O AI-DLC grava as perguntas em arquivos `{etapa}-questions.md` dentro de `aidlc-docs/` (ex.: `aidlc-docs/inception/requirements-analysis/requirements-analysis-questions.md`):

- cada pergunta é um bloco (ex.: `## Q1: <título>`) com opções `A.` a `E.` e a opção obrigatória `X. Other (please specify)`;
- a resposta vai na linha `[Answer]:`;
- o estado está em `aidlc-docs/aidlc-state.md`, com checkboxes `[ ]` / `[x]` por etapa;
- o workflow suporta o modo "I'll edit the file": o humano preenche os `[Answer]:` e o agente relê.

O formato varia entre versões do `aidlc-workflows`. **A versão dos pilotos ainda não foi confirmada**, então o parser precisa de uma camada de adaptação por versão e fixtures baseadas na documentação oficial (https://awslabs.github.io/aidlc-workflows/).

## 3. Escopo do PoC

### 3.1 Perfis (C18)

- Na primeira execução, o usuário escolhe o papel: **Dev** ou **PO** (lista extensível para N papéis). Pode trocar depois nas configurações.
- Perfil é **experiência, não permissão**.
- **Modo PO:** abre na Caixa de Entrada; worktrees, terminais, diffs, editor e catálogo técnico ficam ocultos.
- **Ocultar UI do núcleo não é possível só com plugin.** Implementar o **menor patch possível** no núcleo (um mecanismo genérico de visibilidade de UI por perfil, reaproveitável pelo modo guiado) e registrá-lo em `stk/docs/patches.md`.

### 3.2 Painel AIDLC do dev (C17)

- Detecta `aidlc-docs/` na workspace ativa.
- Mostra:
  - fases (Inception / Construction / Operations) e etapas com progresso, a partir de `aidlc-state.md`;
  - artefatos gerados;
  - perguntas pendentes (`[Answer]:` vazio).
- Permite responder pelo formulário: múltipla escolha A–E, ou X com texto livre. A resposta é gravada no arquivo preservando o formato.
- Ação **"Enviar ao PO"** em uma pergunta: registra a delegação em `aidlc-docs/.stk/delegations.json` (id da pergunta, arquivo, quem pediu, para quem, quando, status) e grava no repositório.
- Ação **"Avisar o agente para reler"**: envia ao agente da sessão um prompt curto pedindo para reler o arquivo de perguntas.

### 3.3 Caixa de Entrada do PO (C18)

- Lista as perguntas pendentes delegadas ao PO **em todos os projetos dele**, com projeto, fase/etapa, quem pediu e há quanto tempo está esperando.
- Responder grava no arquivo de perguntas e atualiza o status da delegação.
- **Sem clonar repositório:** acesso via **API do GitHub** (contents API: ler o arquivo, gravar com commit em nome do usuário).
- **Lista de projetos do PO:** nas configurações do plugin (repositórios `owner/repo` + branch). O token do GitHub vai nos **secrets do plugin**.
- **Avisos:** verificação periódica (intervalo configurável) com badge na status bar e notificação nativa quando há pergunta nova.
- Linguagem de negócio na UI (ex.: "Fase de entendimento" para Inception).

### 3.4 Histórias → Jira (C19)

- Ler as histórias geradas pelo AIDLC no inception. Implementar um adaptador; o caminho e o formato exatos dependem da versão e devem ser confirmados.
- Tela de revisão: lista de histórias com critérios de aceite, edição, seleção.
- Botão **"Lançar no Jira"**: cria um épico (opcional) e as histórias selecionadas, e grava as chaves do Jira de volta no artefato (ex.: `Jira: PROJ-123`) para rastreabilidade.
- Configuração: URL base, projeto, tipos de issue e mapeamento de campos. Suportar Jira Cloud e Data Center via interface. **Reaproveitar a integração Jira nativa do Orca** (`src/main/jira`) quando possível. Se ela só lê, a criação de issues vai no plugin.

## 4. Arquitetura esperada

- **Plugin(s) em `stk/plugins/`**, publisher `stk` (ex.: `stk/plugins/aidlc/`), perfil `trusted-worker`:
  - painéis TSX (`ui: "components"`);
  - worker para rede e arquivos, porque painel não tem rede;
  - settings e secrets declarados.
- **Módulos com interfaces claras e testáveis:**
  - `AidlcQuestionsParser` / `AidlcQuestionsWriter` (por versão);
  - `AidlcStateParser`;
  - `QuestionStore`, com duas implementações: sistema de arquivos local (workspace do dev) e API do GitHub (modo PO);
  - `DelegationStore`;
  - `StoriesAdapter`;
  - `JiraClient`, com implementação REST e implementação fake.
- **Testes** (seguindo a política de testes do `AGENTS.md`): parser e writer com fixtures do formato documentado (ida e volta sem perder conteúdo), `QuestionStore` do GitHub contra servidor fake, e `JiraClient` fake.
- **UI** em pt-BR, seguindo `docs/STYLEGUIDE.md` e os componentes do Orca.
- **Sem servidor próprio**, sem execução remota, sem credenciais reais.

## 5. Restrições do Orca a respeitar

- Painel não tem rede: todo acesso a GitHub e Jira passa pelo worker.
- `agent.prompt.before` não intercepta prompts digitados; usar só para prompts disparados pelo plugin.
- Plugin só adiciona UI; ocultar UI do núcleo exige o patch descrito em 3.1.
- Plugins `trusted-worker` exigem aprovação; para o PoC, instalação local como pasta de desenvolvimento é suficiente.
- Os pontos `skills` e `mcpServers` do manifesto são reservados; não usar.

## 6. Entregáveis

1. Branch `f2a/poc-aidlc-modo-po` com PR para `main`. Descrição do PR em pt-BR: o que foi feito, decisões, limitações, como testar localmente.
2. Plugin(s) validados com `pnpm validate:plugin`.
3. Patch de perfis no núcleo registrado em `stk/docs/patches.md` (arquivos tocados, justificativa).
4. Fixtures de exemplo de `aidlc-docs/` para demonstração.
5. Screenshots dos painéis (via fixtures/CDP conforme o `AGENTS.md`), se o ambiente permitir.
6. Seção "Perguntas em aberto" no PR: versão do aidlc-workflows, formato das histórias, estrutura do Jira.

## 7. Fora do escopo deste PoC

LiteLLM/BYOK, compactação, tool calling, marketplace, KB local, manutenção de CVE, Jira→worktree (C15) e mudanças de marca/identidade. Isso vem em PoCs seguintes.
