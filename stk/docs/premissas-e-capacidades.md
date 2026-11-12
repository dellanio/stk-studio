# Relatório de críticas ao plano técnico "Squad Toolkit IA"

**De:** Dellanio Alencar (F2A)
**Para:** autor do plano técnico (e a LLM que o apoia)
**Data:** 12/11/2026
**Objetivo deste documento:** explicar **nossas premissas**, **onde precisamos chegar**, o que o plano **acertou**, o que **ainda falta**, e dar **instruções** para a próxima versão do plano.

---

## 0. Como usar este documento

Se você é a LLM que ajuda a revisar o plano:

1. Leia este documento inteiro **antes** de propor mudanças.
2. Trate a **seção 1 (Premissas)** como restrições obrigatórias. Não proponha soluções que as violem.
3. Use a **seção 2 (Onde precisamos chegar)** como a definição de "pronto" do produto.
4. Preserve o que está na **seção 3 (Acertos)**. Não reescreva o que já está correto.
5. Use a **seção 5 (Restrições técnicas do Orca)** como fatos verificados no código. Se discordar de algum, cite o arquivo e a linha que comprovam.
6. Siga as **instruções da seção 7** para produzir a próxima versão do plano.

---

## 1. Premissas (restrições obrigatórias)

| #   | Premissa                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | O produto é um **ADE (Agentic Development Environment) corporativo** construído sobre um **fork do Orca** (stablyai/orca). O foco é **entregar vantagens reais aos devs e à empresa**: economia, produtividade, conhecimento compartilhado e padronização.                                                                                                 |
| P2  | **O núcleo do Orca muda o mínimo possível.** No núcleo entram só política de update, identidade, desligamento ou ocultação de módulos e ganchos estritamente necessários. **Todas as features do F2A são construídas como plugins** (sistema de plugins nativo do Orca) **ou como serviços** fora do app.                                                  |
| P3  | O fork deve continuar **rebaseável** sobre versões futuras do Orca, por uma **lista fechada de patches** com testes como portão.                                                                                                                                                                                                                           |
| P4  | **O LiteLLM é o canal corporativo de economia** e deve ser o caminho padrão do consumo de LLM do ADE. Não é opcional.                                                                                                                                                                                                                                      |
| P5  | **O ADE não substitui o editor.** Visualização rápida, revisão e diffs ficam no ADE; edição pesada e debug, no VS Code (botão "Abrir no VS Code").                                                                                                                                                                                                         |
| P6  | Agentes suportados: **Copilot CLI** (aprovado hoje) e **Claude Code** (em breve); outros no futuro. Sem lock-in de agente.                                                                                                                                                                                                                                 |
| P7  | **Zero config para o dev:** tudo vem pré-configurado na instalação.                                                                                                                                                                                                                                                                                        |
| P8  | **Segurança é piso obrigatório, não a meta final.** Critérios de segurança são portão de go/no-go, e o sucesso é medido por vantagem real e adoção.                                                                                                                                                                                                        |
| P9  | Compactação de contexto e otimização de tool calling são **implementação própria do F2A** (a compactação já existe hoje). Não é obrigatório adotar Headroom, RTK ou outra ferramenta de terceiros.                                                                                                                                                         |
| P10 | O plano trata de **como construir a plataforma sobre o Orca**. Não precisa tratar de tamanho de equipe, prazos ou custos do projeto.                                                                                                                                                                                                                       |
| P11 | **Execução 100% local.** Agentes, worktrees e automações rodam na máquina do dev. **Nada de execução remota:** sem worktrees via SSH, VMs efêmeras, runtime cloud, relay ou servidor remoto do Orca. Esses módulos devem ser desligados. (Serviços corporativos consumidos pela rede, como LiteLLM, Jira, GitHub, Mend e Checkmarx, continuam permitidos.) |
| P12 | **Ponto único de IA e AIDLC da empresa.** O Orca F2A é o lugar onde devs, POs e demais papéis trabalham com IA e com o AIDLC. **Nada de portais ou ferramentas paralelas:** o PO usa o mesmo app, num modo simplificado. O estado compartilhado vive no repositório (`aidlc-docs/`) e no Jira; não há servidor próprio novo.                               |

---

## 2. Onde precisamos chegar (capacidades-alvo)

O produto final precisa ter **todas** as capacidades abaixo, a maioria como **itens visuais dentro do ADE**:

| #   | Capacidade                                                     | Descrição                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Economia de LLM via LiteLLM**                                | Consumo roteado pelo LiteLLM (roteamento, fallback, orçamento, política por dev e por repositório). Copilot CLI via **BYOK oficial** apontando para o LiteLLM; Claude Code via `ANTHROPIC_BASE_URL`                                                                                                                                 |
| C2  | **Compactação de contexto**                                    | Implementação F2A existente, aplicada no caminho do LiteLLM                                                                                                                                                                                                                                                                         |
| C3  | **Otimização de tool calling**                                 | Função própria que compacta a saída de comandos (git, build, testes, listagens) antes do modelo                                                                                                                                                                                                                                     |
| C4  | **Vault / second brain corporativo**                           | Conhecimento hierárquico da empresa entregue aos agentes por MCP, sem configuração                                                                                                                                                                                                                                                  |
| C5  | **Knowledge base local do dev** _(vem do Squad Toolkit atual)_ | Biblioteca pessoal do dev, na máquina dele: adiciona documentos, notas e referências e os anexa como contexto nas conversas com os agentes. Item visual no ADE                                                                                                                                                                      |
| C6  | **Marketplace de agentes** _(vem do Squad Toolkit atual)_      | Toda a empresa publica, descobre, instala e reaproveita agentes, skills e workflows construídos por outras squads. Item visual no ADE, com curadoria, versionamento e governança                                                                                                                                                    |
| C7  | **Fluxo padrão SDD / AIDLC**                                   | Wizard visual: spec → plano → tarefas (worktrees) → execução por agentes → revisão/PR                                                                                                                                                                                                                                               |
| C8  | **Migração do Squad Toolkit**                                  | Tudo o que a extensão de VS Code faz hoje passa a existir no ADE (skills, MCP, painéis), com convivência até a paridade                                                                                                                                                                                                             |
| C9  | **Canal de novidades**                                         | Painel com changelog, dicas, novas skills e agentes, e feedback do dev; distribuição por catálogo interno                                                                                                                                                                                                                           |
| C10 | **Multi-agente com worktrees, git nativo e diffs**             | Capacidades nativas do Orca, mais o botão "Abrir no VS Code"                                                                                                                                                                                                                                                                        |
| C11 | **Experiência guiada**                                         | Primeira execução guiada e missões por trilha (Backend/Java, Front, Mobile, QA)                                                                                                                                                                                                                                                     |
| C12 | **Dashboard de valor**                                         | Economia, produtividade, qualidade e adoção (agregado; respeitando LGPD)                                                                                                                                                                                                                                                            |
| C13 | **Marca visual e identidade próprias**                         | Coexistindo com o Orca original na mesma máquina                                                                                                                                                                                                                                                                                    |
| C14 | **Controle corporativo**                                       | Updates, plugins, catálogo, dados e credenciais sob política, com auditoria                                                                                                                                                                                                                                                         |
| C15 | **Integração com o Jira corporativo**                          | Do ticket à worktree: escolher a issue no ADE, criar a worktree e abrir o wizard SDD já preenchido com a história; status e comentários de volta no Jira. Item visual no ADE. Demanda frequente dos devs                                                                                                                            |
| C16 | **Agentes agendados de manutenção de segurança**               | Automações locais e agendadas que buscam as vulnerabilidades **críticas** apontadas pelo **Mend** e pelo **Checkmarx** nos repositórios GitHub, aplicam a correção numa worktree, rodam build e testes e abrem PR com evidências para revisão humana. Painel visual de acompanhamento no ADE                                        |
| C17 | **AIDLC como fluxo do ADE**                                    | O AI-DLC da AWS (`awslabs/aidlc-workflows`, MIT-0) empacotado com versão fixada e distribuído pelo catálogo. Painel visual com fases (inception, construction, operations), etapas, progresso (`aidlc-state.md`) e botões de aprovação dos portões. Carregamento da transcrição da ideação como insumo do inception                 |
| C18 | **Perfis e modo PO**                                           | Na primeira execução, o usuário informa o seu papel (dev, PO, ...), com troca permitida. O PO vê um modo simplificado: caixa de entrada de perguntas do workflow (todos os projetos dele), formulário amigável de resposta, perguntas assíncronas enviadas pelo dev, status das fases. O dev deixa de ser o digitador das respostas |
| C19 | **Histórias para o Jira com um clique**                        | Após o AIDLC gerar as histórias, o PO revisa, edita, seleciona e lança no Jira com um botão (épico + histórias + critérios de aceite). As chaves do Jira voltam para o repositório, garantindo rastreabilidade ideação → pergunta → história → PR                                                                                   |

---

## 3. O que o plano acertou

Estes pontos devem ser **mantidos**:

| Item do plano                                                                                                                                                                                                       | Avaliação                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **STIA-002/003/004** — updater desligado por **política de build**, `DisabledUpdaterService`, estado `disabled-by-policy`, bloqueio de catálogos upstream, kill list, estatísticas, star prompts e update do mobile | ✅ Diagnóstico correto (`autoDownload = false` não impede verificações; feed público conferido em `updater-setup.ts`). Mais rigoroso que alternativas por configuração |
| **§2.8** — testes de zero chamadas de rede                                                                                                                                                                          | ✅ É a evidência que segurança vai exigir                                                                                                                              |
| **STIA-005 + §3.2** — rebranding com **checklist anti-colisão** (singleton, userData, daemon, socket, CLI, protocolo `squadia://`)                                                                                  | ✅ Essencial para coexistir com o Orca original                                                                                                                        |
| **§5** — **vault hierárquico** (empresa → tribo → produto → squad → projeto), precedência, frontmatter com status, resolver de contexto mínimo                                                                      | ✅ Melhor modelo de vault disponível. É a base de C4                                                                                                                   |
| **§5.2** — "evitar acoplamento do Vault à implementação interna do Orca: API versionada própria"                                                                                                                    | ✅ Princípio correto (ver crítica 4.2 sobre a implementação atual)                                                                                                     |
| **§5.3 / STIA-011** — `agent.yaml` e `skill.yaml` com dono, versão, permissões, testes e `risk_tier`                                                                                                                | ✅ Boa base para o **marketplace de agentes (C6)**                                                                                                                     |
| **§4.3** — nenhum segredo persistente entregue ao agente                                                                                                                                                            | ✅ Base para a credencial por dev no LiteLLM                                                                                                                           |
| **"Git worktree não é fronteira de segurança"**                                                                                                                                                                     | ✅ Correto e importante                                                                                                                                                |
| **§8 / §12 / §13** — gates de CI, PRs pequenos por épico, ADRs, documentação, prompt de execução                                                                                                                    | ✅ Disciplina adequada                                                                                                                                                 |
| **§14.10** — lista de patches + procedimento de rebase                                                                                                                                                              | ✅ Alinhado com P3                                                                                                                                                     |
| **Diagnóstico do código** — todos os caminhos citados existem no repositório                                                                                                                                        | ✅ Precisão alta                                                                                                                                                       |
| **"Limite honesto"** sobre o que depende da infraestrutura da organização                                                                                                                                           | ✅ Postura correta                                                                                                                                                     |

---

## 4. O que falta ou precisa mudar

### 4.1 Capacidades ausentes

| Capacidade                                            | Situação no plano                                                           | O que precisa                                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1 — LiteLLM**                                      | ❌ Ausente. Só há "orçamento" e "fallback autorizado" genéricos             | Desenhar o caminho BYOK do Copilot CLI → LiteLLM; plugin que injeta as variáveis ao lançar o agente; política, orçamento e credencial por dev/repo no LiteLLM; endurecimento do LiteLLM |
| **C2 — Compactação**                                  | ❌ Ausente                                                                  | Integrar a compactação F2A existente no caminho do LiteLLM; validar efeito no cache de prompt e na qualidade                                                                            |
| **C3 — Tool calling**                                 | ❌ Ausente                                                                  | Mecanismo próprio compatível com as restrições do Orca (seção 5)                                                                                                                        |
| **C5 — Knowledge base local**                         | ❌ Ausente                                                                  | Desenho completo (ver 4.4)                                                                                                                                                              |
| **C6 — Marketplace de agentes**                       | ⚠️ Há schemas e "registro central", mas não há a experiência de marketplace | Desenho completo (ver 4.5)                                                                                                                                                              |
| **C7 — SDD/AIDLC**                                    | ❌ Ausente no documento inteiro                                             | Plugin com wizard visual e skills/templates no vault                                                                                                                                    |
| **C8 — Migração do Squad Toolkit**                    | ❌ O produto leva o nome, mas não há plano de migração                      | Inventário das funções atuais e mapeamento de cada uma para skill, MCP ou painel                                                                                                        |
| **C9 — Canal de novidades**                           | ⚠️ Há a release manual assinada, mas não há canal para o dev                | Painel de Novidades + catálogo interno com rollout e rollback                                                                                                                           |
| **C11 — Experiência guiada**                          | ❌ Ausente                                                                  | Onboarding e missões por trilha                                                                                                                                                         |
| **C12 — Dashboard de valor**                          | ⚠️ Há observabilidade e FinOps de governança, mas não há métricas de valor  | Métricas de economia, produtividade, qualidade e adoção                                                                                                                                 |
| **C15 — Jira**                                        | ❌ Ausente                                                                  | Desenho completo (ver 4.6)                                                                                                                                                              |
| **C16 — Manutenção de segurança agendada**            | ❌ Ausente                                                                  | Desenho completo (ver 4.7)                                                                                                                                                              |
| **C17–C19 — AIDLC, perfis/modo PO, histórias → Jira** | ❌ Ausente                                                                  | Desenho completo (ver 4.8)                                                                                                                                                              |

### 4.2 Código próprio dentro do núcleo (viola P2/P3)

Há código em `src/shared/enterprise` e `src/main/enterprise`. Recomendação:

| Fica no núcleo                                              | Sai do núcleo                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `update-policy.ts`, `DisabledUpdaterService`                | `vault-document.ts` e o resolver → **serviço de vault** (API versionada + MCP)                         |
| `squad-toolkit-ia-identity.cjs`, appId, protocolo, caminhos | `audit-ledger.ts`, `run-budget.ts` → serviço de auditoria e LiteLLM                                    |
| Bloqueio de endpoints e catálogos upstream                  | `access-policy.ts`, `governance-scope.ts` → LiteLLM (política) + plugin com hooks `onError: "deny"`    |
| Desligamento e ocultação de módulos                         | `agent-run.ts`, `catalog-manifest.ts` → pacote próprio usado por plugins e pelo backend do marketplace |
| Pré-aprovação de plugins F2A e catálogo interno exclusivo   | —                                                                                                      |
| Ganchos mínimos de UI (modo guiado, ocultar painéis)        | —                                                                                                      |

### 4.3 Escopo da governança

O **control plane do §6** (API gateway próprio, PDP, orchestrator, execution broker, DAG, checkpoints) e o **sandbox por execução** são uma **arquitetura-alvo válida**, mas:

- não são necessários para entregar as capacidades C1 a C19;
- o **execution broker com sandboxes remotas contraria a premissa P11** (execução 100% local);
- dependem de infraestrutura da organização.

**Recomendação:** marcar como **fase posterior** e redesenhar o isolamento para **execução local** (ex.: sandbox no próprio SO do dev, quando houver). No começo, política e orçamento no LiteLLM, credencial por dev/repo, catálogo fechado, auditoria enviada ao SIEM, egress pelo proxy corporativo e uma decisão de risco documentada sobre a execução local.

### 4.4 Knowledge base local (C5) — pontos a desenhar

- **Armazenamento:** pasta local do dev (dentro do userData do ADE), com documentos (md, pdf, txt, código) e notas.
- **Indexação local:** busca textual e/ou vetorial **na máquina**, sem enviar o conteúdo para fora até o momento do uso.
- **Exposição aos agentes:** **servidor MCP local** (ex.: `kb.search`, `kb.get`, `kb.add`), registrado em todos os agentes pelo bootstrap.
- **UI no ADE:** painel "Minha biblioteca" para adicionar (arrastar e soltar), organizar por coleções/tags, buscar e **anexar ao contexto** da sessão atual.
- **Fronteira com o vault corporativo:** a KB local é **pessoal e privada**; o vault é **corporativo e curado**. Definir precedência quando os dois respondem (o vault corporativo vence em política) e um fluxo opcional de "promover para o vault" com revisão.
- **Segurança:** classificação do conteúdo, dados sensíveis não podem sair pelo LiteLLM sem política, e conteúdo tratado como não confiável contra prompt injection.
- **Referência no Orca:** existem os módulos `src/main/ai-vault` e `src/main/ai-vault-search`, que indexam e buscam **sessões e transcripts locais** dos agentes. Avaliar o que pode ser reaproveitado (indexação, SQLite, busca) sem acoplar a KB a eles.

### 4.5 Marketplace de agentes (C6) — pontos a desenhar

- **Itens publicáveis:** agentes, skills, workflows/recipes, templates SDD, servidores MCP e plugins do ADE.
- **Manifesto:** reaproveitar `agent.yaml` / `skill.yaml` do §5.3 (dono, versão, permissões, `risk_tier`, testes).
- **Distribuição:**
  - plugins do ADE → **catálogo próprio do Orca** (git, commit fixo, hash SHA-256);
  - agentes, skills e MCP → **catálogo F2A próprio**, instalado pelo bootstrap, porque os pontos `skills` e `mcpServers` do manifesto do Orca ainda são reservados.
- **Fluxo de publicação:** submissão → validação automática (schema, testes, varredura de segredos e de licença) → revisão por escopo (CODEOWNERS) → publicação versionada → rollout progressivo → rollback.
- **UI no ADE:** painel "Marketplace" com busca, filtros (tribo, stack, tipo, risco), página do item (dono, versões, permissões pedidas, avaliações, uso), instalar/atualizar/remover e "publicar o meu".
- **Escopos de visibilidade:** empresa / tribo / produto / squad, alinhados à hierarquia do vault.
- **Métricas:** instalações, uso, avaliações e reaproveitamento entre squads (é o indicador de valor do marketplace).
- **Segurança:** item instalado é código de terceiros. Permissões explícitas, revisão obrigatória para `risk_tier` alto, assinatura e revogação.

### 4.6 Integração com o Jira (C15) — pontos a desenhar

- **Base nativa do Orca:** o núcleo já tem integração com Jira (`src/main/jira`, componentes `jira-project-picker`, `JiraPromptTemplatePopover`, `jira-issue-workspace-request` no renderer): seleção de projeto, criação de workspace a partir da issue, templates de prompt e responsável. **Reaproveitar, não reconstruir.**
- **Validar a compatibilidade com o Jira do banco:** o código mostra suporte claro ao Jira Cloud (`atlassian.net`, REST v3) e referências a REST v2 e token pessoal (PAT). Confirmar se funciona com a instância corporativa (Data Center/Server, SSO, proxy, certificados internos) e o que precisa de ajuste.
- **Fluxo-alvo:**
  1. O dev escolhe a issue no ADE (filtros por projeto, sprint, responsável).
  2. O ADE cria a worktree com branch nomeada pela issue.
  3. O wizard SDD abre **pré-preenchido** com título, descrição, critérios de aceite e anexos da história.
  4. Os agentes executam.
  5. O PR é vinculado à issue, e status e comentários (link do PR, resumo do que o agente fez) voltam ao Jira.
- **Templates de prompt por tipo de issue** (bug, história, débito técnico) distribuídos pelo **marketplace** (C6).
- **Credenciais:** token do dev no keyring do SO (secrets do Orca). Nunca exposto ao agente.
- **Integrações nativas não usadas** (Linear, Azure DevOps, Bitbucket etc.): desligar ou esconder conforme o inventário.

### 4.7 Agentes agendados de manutenção de segurança (C16) — pontos a desenhar

- **Base nativa do Orca:** o núcleo tem **automações agendadas** (`src/main/automations`): agenda por `rrule`, _precheck_ antes de rodar, workspace dedicado por execução, registro de evidências da execução. **Reaproveitar com execução local** (P11).
- **Fontes:** findings **críticos** do **Mend** (SCA, dependências) e do **Checkmarx** (SAST, código), via API ou MCP dessas ferramentas, filtrados pelos repositórios GitHub sob responsabilidade do dono da automação.
- **Fluxo-alvo por finding:**
  1. Buscar os findings críticos.
  2. Criar a worktree no repositório afetado.
  3. O agente aplica a correção (atualização de dependência ou correção de código) com uma skill específica por tipo de vulnerabilidade.
  4. Rodar build e testes locais.
  5. Revalidar com Mend/Checkmarx.
  6. Abrir PR com evidências (finding de origem, mudança, resultado dos testes, resultado da revalidação).
  7. Aparecer no painel "Correções de segurança" do ADE para revisão.
- **Guardrails obrigatórios:**
  - nunca fazer merge automático;
  - somente severidade crítica (configurável);
  - limite de PRs simultâneos por repositório;
  - não reabrir PR de finding já tratado;
  - falha de build ou teste não abre PR (registra e notifica);
  - permissões mínimas no GitHub.
- **Ponto de atenção — execução local × cobertura:** automação local só roda com a máquina ligada e o ADE aberto. Para cobrir **todos** os repositórios críticos, definir **quem é dono** de cada automação (ex.: cada squad roda para os seus repositórios, a partir da máquina de um responsável) e como tratar repositórios sem dono. O desenho precisa garantir cobertura sem violar P11.
- **Distribuição:** automação e skills de correção como **itens aprovados do marketplace** (C6), com dono e versão.
- **Métricas:** findings críticos abertos × corrigidos, tempo do finding ao PR, taxa de PRs aceitos, taxa de falha de build e teste.

### 4.8 AIDLC, perfis/modo PO e histórias → Jira (C17–C19) — pontos a desenhar

**Contexto:** hoje os pilotos de AIDLC (workflows da AWS) reúnem o time numa sala. A ideação é gravada e transcrita e passada ao workflow, mas **quem digita todas as respostas no CLI é o dev**. As dúvidas posteriores ao PO se perdem no Teams, e as histórias geradas são copiadas e coladas manualmente no Jira.

**Fato técnico que viabiliza o desenho:** o AI-DLC grava as perguntas em arquivos `{etapa}-questions.md`, com opções A–E, a opção obrigatória "X. Outro (especifique)" e tags `[Answer]:`. O estado fica em `aidlc-docs/aidlc-state.md`, e o próprio workflow suporta o modo "eu edito o arquivo". Portanto **a resposta não depende do CLI**: uma tela pode ler os arquivos, renderizar formulários e gravar as respostas.

**C17 — AIDLC no ADE**

- Empacotar o `aidlc-workflows` com **versão fixada**, distribuído pelo catálogo F2A. Atualizações do upstream só após teste.
- **Camada de adaptação por versão:** o formato dos arquivos e do estado muda entre versões (as recentes usam scripts próprios de estado e log). A UI não pode depender de um formato não versionado.
- **Painel AIDLC do dev:** fases, etapas, progresso, artefatos gerados, perguntas pendentes, aprovação de portões e botão "Enviar ao PO".
- **Insumo da ideação:** carregar a transcrição revisada como contexto do inception. Gravação é dado pessoal (LGPD): guardar a transcrição revisada e descartar o áudio.
- **Integração com C15:** a ideação pode nascer de um épico do Jira.

**C18 — Perfis e modo PO**

- **Escolha de papel** na primeira execução (dev, PO, ...), com troca permitida. Perfil é **experiência, não permissão**: o que cada um pode gravar é controlado pelo GitHub e pelo Jira. Integração com o IdP fica para depois.
- **Modo PO:** abre na caixa de entrada.
  - **Visível:** perguntas pendentes por projeto (há quanto tempo esperam, quem pediu, em qual fase), formulário de resposta, revisão de histórias, status das fases.
  - **Escondido:** worktrees, terminais, diffs, editor e catálogo técnico.
  - **Linguagem de negócio:** "fase de entendimento" em vez de "inception".
- **Sem clonar repositório:** o modo PO lê os arquivos de perguntas e grava as respostas **pela API do GitHub** (commit em nome do PO). Definir a permissão do PO: escrita só em `aidlc-docs/`, ou branch com PR automático.
- **Perguntas assíncronas:** o dev envia a pergunta ao PO pelo ADE; ela aparece na caixa do PO; a resposta grava no arquivo, notifica o ADE do dev, e o agente relê.
- **Avisos:** verificação periódica dos repositórios dos projetos do PO, com notificação nativa e badge. Com o app fechado, o fallback é o Jira (já usado), não um canal novo.
- **Restrição do Orca:** plugin não esconde UI do núcleo. O modo simplificado exige o **patch de UI por perfil** no núcleo, o mesmo do modo guiado (C11). Projetar como um único mecanismo.
- **Onboarding do PO:** tour curto (responder uma pergunta, revisar uma história).

**C19 — Histórias → Jira**

- Ler as histórias geradas pelo AIDLC, mostrar com critérios de aceite, permitir edição e seleção.
- Botão **"Lançar no Jira"**: cria o épico e as histórias (respeitando os tipos e campos obrigatórios da instância corporativa) e grava as chaves do Jira de volta no artefato do repositório.
- Reaproveitar a integração Jira nativa do Orca (C15). Validar se ela cria issues ou só lê; se só ler, estender via plugin.
- Registrar no log de auditoria do AIDLC quem lançou o quê.

**Decisões em aberto (confirmar com o F2A):**

- O AIDLC substitui o wizard SDD (C7) como fluxo padrão, ou os dois convivem?
- Qual versão do `aidlc-workflows` os pilotos usam?
- Qual a estrutura do Jira (épico → história → subtarefa, tipos e campos obrigatórios)?

### 4.9 Rubrica (§11)

- Manter os **critérios bloqueantes de segurança como portão** de go/no-go.
- Medir o sucesso do produto por **vantagem real**:
  - **economia:** consumo pelo LiteLLM, tokens economizados por compactação e tool calling, custo por tarefa concluída;
  - **produtividade:** PRs assistidos, tempo da spec ao PR;
  - **qualidade:** testes verdes, retrabalho;
  - **adoção:** ativação, uso semanal;
  - **reaproveitamento:** itens do marketplace usados entre squads, uso da KB e do vault.
- Hoje UX/adoção vale 5%, o que não reflete o objetivo do produto.

### 4.10 Estratégia de fork

- Trocar "fork fixo no SHA" por **fila de patches rebaseada periodicamente** sobre tags do upstream, com E2E como portão, e entrega aos devs por um canal estável.
- **Electron:** a versão fixada é a 43.8.7, com fim de suporte previsto para o início de 2027. Upgrade é requisito de segurança.
- **Tag base:** os hooks de plugin exigem Orca ≥ 1.4.248 (≥ 1.4.253 para fontes). Confirmar a disponibilidade em release estável.
- **Inventário de desligamento:** decidir módulo a módulo, por exemplo `browser-passwords`, `computer`, `connector-cloud`, `speech`, servidor web e endpoints de relay/push/share/login em `onorca.dev`. Pela P11, desligar também **worktrees via SSH, `ephemeral-vm`, runtime/servidor remoto, `orca serve`, relay mobile** e o caminho de automações via SSH.
- **Publisher:** próprio (ex.: `f2a`). Nomes iniciados em `orca` são reservados.

---

## 5. Restrições técnicas do Orca (verificadas no código)

| Restrição                                                                                                                 | Implicação para o desenho                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `agent.launch.before` altera `command` e `env`, **não o tipo de agente**                                                  | Usar para injetar BYOK/gateway; não para trocar de agente                                         |
| `agent.prompt.before` **não intercepta prompts digitados** pelo dev                                                       | Contexto de vault, KB e SDD entra por **MCP e skills**                                            |
| `agent.tool.before` só **decide** para Claude Code; `agent.tool.after` **não altera** saída; hooks de tool não cobrem WSL | C3 precisa de outro mecanismo: shim no PATH, hooks nativos dos agentes ou ferramentas MCP enxutas |
| Hook > 2 s conta como "passou"; `onError: "deny"` falha fechado                                                           | Guardas com `onError: "deny"` e sem chamadas lentas antes de decidir                              |
| Restore/resume não passa por `agent.launch.before`                                                                        | Configuração do gateway também no ambiente do agente, não só no hook                              |
| `workspace.create.after` não bloqueia                                                                                     | Setup obrigatório da worktree por outro mecanismo                                                 |
| Painel não tem rede; worker é Node sem sandbox e fora do log de auditoria do Orca                                         | Plugins F2A serão `trusted-worker`: assinar, revisar por release, auditar no SIEM                 |
| Só plugins `data` empacotados são aprovados sem revisão; não há chave global para bloquear plugins de acesso total        | Pré-aprovação e "somente catálogo F2A" são **patches de código**                                  |
| Fora do catálogo oficial: release listada por 12 h; update com nova capability ou painel exige nova aprovação             | Considerar no canal de novidades e no marketplace                                                 |
| Plugin só **adiciona** UI                                                                                                 | Modo guiado e ocultação de painéis exigem gancho no núcleo                                        |
| `skills` e `mcpServers` no manifesto ainda são reservados                                                                 | Skills e MCP distribuídos pelo catálogo F2A + bootstrap                                           |

---

## 6. Arquitetura de referência

```
┌──────────────────────────────────────────────────────────────────┐
│                      ADE (fork do Orca)                          │
│  Núcleo (patches mínimos)        Plugins F2A (painéis + workers) │
│  - worktrees / multi-agente      - SDD/AIDLC     - Marketplace   │
│  - git / diffs / editor          - Minha biblioteca (KB local)   │
│  - plugins / catálogo            - Novidades     - Onboarding    │
│  - abrir no VS Code              - Dashboard     - Gateway/BYOK  │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
   Copilot CLI (BYOK) · Claude Code · outros
               │
   Serviços locais: MCP da KB local · MCP do vault · tool calling enxuto
               │
               ▼
   LiteLLM corporativo: roteamento · orçamento · política · compactação F2A · auditoria
               │
   Serviços corporativos: vault (API + MCP) · catálogo/marketplace · auditoria/SIEM
```

---

## 7. Instruções para a próxima versão do plano

### 7.1 O que produzir

Uma **versão 2** do plano técnico que:

1. **Mantém** os itens da seção 3.
2. **Adiciona um épico para cada capacidade** C1–C19 que hoje está ausente ou parcial, com: objetivo, desenho (plugin, serviço ou patch), uso das APIs do Orca, restrições da seção 5 consideradas, critérios de aceite verificáveis e testes.
3. **Reorganiza o código** conforme a seção 4.2 e publica a **lista fechada de patches do núcleo**, cada um com justificativa.
4. **Reclassifica** o control plane, o broker e o sandbox por execução como **arquitetura-alvo de fase posterior** (seção 4.3).
5. **Reescreve a rubrica** conforme a seção 4.9.
6. **Atualiza a estratégia de fork** conforme a seção 4.10.
7. **Ordena os épicos por dependência técnica**, sem datas.

### 7.2 Perguntas para guiar o raciocínio

Responda explicitamente no plano:

- **Núcleo:** para cada mudança proposta no núcleo, por que não pode ser plugin ou serviço? Quantos arquivos ela toca? Como fica o rebase?
- **LiteLLM:** como o Copilot CLI e o Claude Code chegam ao LiteLLM em todos os modos de execução (lançamento, restore, resume, terminal comum)? Onde ficam política, orçamento e credencial por dev? Como a credencial é emitida, rotacionada e revogada sem ficar legível pelo agente?
- **Compactação:** em que ponto do LiteLLM ela roda? Como ela convive com o cache de prompt? Como medir economia e regressão de qualidade?
- **Tool calling:** qual mecanismo funciona com o Copilot CLI dado que `agent.tool.before` não decide para ele? Como funciona em WSL?
- **KB local:** como o dev adiciona, organiza e anexa contexto? O que fica local e o que pode sair pelo LiteLLM? Como se relaciona com o vault corporativo?
- **Marketplace:** o que pode ser publicado, por quem, com qual revisão? Como instalar agentes e skills se o manifesto do Orca ainda não suporta esses pontos? Como revogar um item publicado?
- **SDD/AIDLC:** como o wizard cria worktrees, dispara agentes e leva a spec aprovada até eles? Como o fluxo funciona também fora do ADE?
- **Squad Toolkit:** qual é o inventário completo das funções atuais e o destino de cada uma (skill, MCP, painel)?
- **Experiência:** o que o dev vê na primeira execução? O que fica escondido até ele pedir?
- **Jira:** a integração nativa do Orca funciona com a instância corporativa? Como a história preenche o wizard SDD? O que volta para o Jira?
- **Manutenção de segurança:** como obter os findings críticos do Mend e do Checkmarx? Como garantir cobertura de todos os repositórios críticos com execução apenas local? Quais guardrails impedem PRs ruins ou duplicados?
- **AIDLC (C17–C19):** como a UI lê e grava os arquivos de perguntas do AI-DLC de forma estável entre versões? Como o modo PO funciona sem clonar repositório? Como o PO é avisado de perguntas novas? Como as histórias viram issues no Jira e as chaves voltam ao repositório?
- **Ponto único (P12):** o que mais hoje vive em outro portal ou ferramenta e deveria entrar no Orca F2A?
- **Execução local (P11):** quais módulos remotos do Orca (SSH, VM efêmera, servidor/runtime remoto, relay) são desligados, e como você prova que nada roda fora da máquina?
- **Valor:** quais métricas provam economia, produtividade, qualidade, adoção e reaproveitamento? Como coletá-las respeitando a LGPD?

### 7.3 Critérios de aceite do plano v2

- [ ] Todas as capacidades C1–C19 têm épico com desenho, uso das APIs do Orca e critérios de aceite.
- [ ] Nenhuma feature F2A está implementada dentro do núcleo sem justificativa registrada na lista de patches.
- [ ] As restrições da seção 5 aparecem tratadas nos épicos afetados.
- [ ] O LiteLLM é o caminho padrão de consumo de LLM, com BYOK do Copilot CLI desenhado.
- [ ] KB local e marketplace de agentes têm desenho de UI, armazenamento, distribuição e segurança.
- [ ] Jira e agentes de manutenção de segurança (Mend/Checkmarx) reaproveitam as integrações e automações nativas do Orca, com guardrails e cobertura definidos.
- [ ] Nenhuma execução remota (P11); módulos remotos do Orca desligados e testados.
- [ ] AIDLC, modo PO e histórias → Jira (C17–C19) desenhados sobre os arquivos do AI-DLC e a API do GitHub, sem servidor próprio novo (P12).
- [ ] A rubrica mede vantagem real e mantém segurança como portão.
- [ ] A estratégia de fork contempla rebase periódico, Electron com suporte e inventário de desligamento.
- [ ] O plano não depende de premissas sobre tamanho de equipe, prazos ou custos do projeto.
