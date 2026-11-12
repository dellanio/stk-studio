# Recomendações — Como usar o fork do Orca para construir o nosso ADE corporativo

**De:** Dellanio Alencar (F2A)
**Para:** time responsável pelo fork
**Data:** 12/11/2026
**Base:** plano técnico "Squad Toolkit IA" do time, plano "Orca F2A" do F2A e uma revisão técnica dos dois, com conferência direta no código do Orca

---

## 1. Objetivo

Usar o fork do Orca como base de um **ADE (Agentic Development Environment) corporativo** que entregue **vantagens reais** aos devs e à empresa:

- **Economia:** consumo de LLM roteado pelo **LiteLLM**, o canal corporativo de economia, com compactação de contexto e de saída de ferramentas.
- **Produtividade:** agentes em paralelo em worktrees isoladas, git nativo, revisão rápida de diffs e um fluxo padrão SDD/AIDLC.
- **Conhecimento:** vault e second brain corporativos entregues a todos os agentes, sem configuração manual.
- **Padronização:** skills, agentes e regras distribuídos por um catálogo interno.
- **Controle:** updates, plugins e dados sob política corporativa, com auditoria.
- **Liberdade de agente:** Copilot CLI hoje, Claude Code e outros depois, sem lock-in de editor.

O plano atual do time é sólido na **fundação**: updater, identidade, vault e segurança. Alguns pontos já estão implementados e o diagnóstico do código é preciso (os caminhos citados foram conferidos no repositório). As recomendações abaixo complementam essa base com as **features de valor** e com um **modelo de construção que aproveita o que o Orca já oferece**.

---

## 2. Princípios de arquitetura

1. **O núcleo do Orca muda o mínimo possível.** No núcleo entram só política de update, identidade e desligamento de módulos. O resto é plugin ou serviço.
2. **As features F2A usam o sistema de plugins nativo do Orca:** painéis, workers, hooks, status bar, settings, secrets e catálogo próprio.
3. **Economia e política ficam no gateway (LiteLLM)**, não na interface. Assim valem para qualquer agente e não podem ser contornadas pelo terminal.
4. **Contexto portável:** skills, AGENTS.md e MCP funcionam no ADE, no VS Code e no CLI puro.
5. **O ADE não substitui o editor.** Visualização rápida e revisão ficam no ADE; edição pesada e debug, no VS Code (botão "Abrir no VS Code").

```
┌──────────────────────────────────────────────────────────────┐
│                     ADE (fork do Orca)                       │
│  Núcleo Orca (mínimo de patches)   Plugins F2A               │
│  - worktrees / agentes paralelos   - SDD/AIDLC (wizard)      │
│  - git nativo / diffs / editor     - Novidades               │
│  - terminais / browser             - Onboarding (guiado)     │
│  - sistema de plugins              - Dashboard de valor      │
│  - abrir em editor externo         - Integração gateway/BYOK │
└──────────────┬───────────────────────────────────────────────┘
               │ inicia agentes CLI com env definido pelo plugin
               ▼
     Copilot CLI (nativo ou BYOK)  ·  Claude Code  ·  outros
               │                         │
               │      Serviços locais: otimização de tool calling,
               │      MCP do vault / second brain / Squad Toolkit
               ▼                         ▼
   GitHub Copilot (nativo)      LiteLLM corporativo
                                - roteamento / fallback / orçamento
                                - compactação de contexto F2A
                                - política por dev/repositório, auditoria
```

---

## 3. O que o Orca já oferece e como usamos

Conferido no código e na documentação do repositório (`docs/reference/plugin-*.md`, `src/main/plugins/`).

| Capacidade nativa | Como usamos no ADE |
|---|---|
| Worktree por tarefa, agentes em paralelo, cerca de 45 agentes CLI suportados | Execução paralela de tarefas do fluxo SDD; Copilot CLI e Claude Code |
| Source control, diffs, editor embutido, busca, browser | Revisão rápida do que os agentes produziram |
| Abrir em editor externo | Botão "Abrir no VS Code" para edição pesada e debug |
| **Plugins:** perfis `data`, `declarative`, `sandboxed-ui`, `trusted-worker` | Tema (`data`); painéis e lógica F2A (`trusted-worker`) |
| **Painéis** na barra lateral (HTML ou TSX sem build) | SDD, Novidades, Onboarding, Dashboard, Squad Toolkit |
| **Hooks:** `agent.launch.before` (altera `command` e `env`), `agent.prompt.before`, `agent.tool.before/after`, `workspace.create.*`, `terminal.send`, `editor.save.before` | Injeção do BYOK/gateway ao lançar agentes; injeção da spec SDD nos prompts disparados pelo ADE |
| **Status bar, settings, secrets** (keyring do SO) | Agente/modelo ativo, economia, novidades; configuração do gateway |
| **Catálogo próprio** com commit fixo e hash SHA-256 | Distribuição controlada de plugins, skills e agentes F2A |
| **Plugins empacotados** no build | Plugins F2A já presentes na instalação |
| **Temas, ícones, fontes, language packs** | Marca visual sem mexer no núcleo |

### Restrições do Orca a respeitar no desenho

| Restrição | Consequência |
|---|---|
| `agent.launch.before` muda `command` e `env`, mas **não o tipo de agente** | Não trocar de agente pelo hook (a aba ficaria com o rótulo errado). Usar o hook para **injetar env** (BYOK, gateway) |
| `agent.prompt.before` **não intercepta prompts digitados** pelo dev | Contexto de vault e SDD entra por **MCP e skills**; o hook só complementa os prompts que o ADE dispara |
| `agent.tool.before` só **decide** para Claude Code; para os demais agentes é notificação. `agent.tool.after` **não altera** a saída. Hooks de tool não cobrem WSL | A otimização de tool calling não pode depender desses hooks (ver 4.3) |
| Hook acima de 2 s conta como "passou"; existe `onError: "deny"` para falhar fechado | Nenhuma chamada lenta antes de decidir; guardas usam `onError: "deny"` |
| Restaurar ou retomar sessão não passa por `agent.launch.before` | A configuração do gateway também precisa existir fora do hook (bootstrap do ambiente do agente) |
| `workspace.create.after` só observa; o Orca não espera por ele | Setup da worktree que precisa terminar antes do agente usa outro mecanismo (ex.: `orca.yaml` / setup do projeto) |
| Painel não tem rede; o worker roda Node sem sandbox e fora do log de auditoria do Orca | Quase todos os plugins F2A serão `trusted-worker`. Por isso: assinatura e revisão por release, e auditoria própria enviada ao SIEM |
| Só plugins `data` empacotados são aprovados sem revisão; não há chave global para bloquear plugins de acesso total | Pré-aprovação e "somente catálogo F2A" exigem **patch no núcleo** (não é configuração) |
| Fora do catálogo oficial, release de plugin fica 12 h listada; update que adiciona capability ou painel exige nova aprovação | Considerar no canal de novidades; avaliar patch no build corporativo para o catálogo interno |
| Plugin só **adiciona** UI; não esconde partes do núcleo nem abre painel sozinho | Modo guiado e "painéis avançados escondidos" exigem patch no núcleo |
| Pontos `skills` e `mcpServers` do manifesto ainda são reservados | Skills e MCP distribuídos por bootstrap próprio até o formato existir |

---

## 4. Features de valor e como construí-las no Orca

### 4.1 Economia de LLM via LiteLLM

O LiteLLM é o **canal corporativo de economia** e deve ser o caminho padrão do consumo de LLM do ADE.

- **Copilot CLI com BYOK oficial** apontando para o LiteLLM (`COPILOT_PROVIDER_BASE_URL`, `COPILOT_PROVIDER_TYPE`, `COPILOT_PROVIDER_API_KEY`, `COPILOT_MODEL`). O Copilot Chat do VS Code também tem BYOK. Usa o agente já aprovado, sem homologar outro.
- **Claude Code** aponta para o LiteLLM via `ANTHROPIC_BASE_URL` quando for liberado.
- **Plugin de integração:** ao lançar o agente (`agent.launch.before`), injeta as variáveis do gateway. A guarda usa `onError: "deny"`.
- **Decisão de roteamento no LiteLLM:** modelo, fallback, orçamento por tribo/produto, sensibilidade do repositório. A cobrança do Copilot é por AI Credits consumidos por token (desde 01/06/2026); a política "Copilot nativo × LiteLLM" é definida no gateway, que tem a visão do consumo da organização.
- **Credencial por dev e por repositório**, emitida e revogável. Nada de chave fixa em `.env` legível pelo agente (alinhado ao §4.3 do plano do time).
- **Endurecimento do LiteLLM** (houve comprometimentos de supply chain do projeto em 2026 e um SQL injection crítico explorado): versões fixadas e espelho interno, imagens verificadas, chaves dos provedores em cofre e fora do banco do proxy, patch rápido de CVEs.

### 4.2 Compactação de contexto

- **Reaproveitar a compactação que o F2A já faz**, como camada da plataforma. Não é necessário adotar uma ferramenta de terceiros.
- **Ponto de aplicação:** no caminho do LiteLLM (proxy ou callback), para valer para todos os agentes que passam por ele.
- O Copilot no caminho nativo (sem BYOK) vai direto ao GitHub e **não passa** pela compactação. Mais um motivo para o BYOK via LiteLLM ser o padrão.
- Validar o efeito no **cache de prompt** dos provedores e medir qualidade antes e depois.

### 4.3 Otimização de tool calling (função tipo RTK)

Implementação própria, que compacta a saída de comandos (git, build, testes, listagens) antes de chegar ao modelo. Como os hooks de tool do Orca não servem para isso com o Copilot CLI (seção 3), os caminhos são:

1. **Shim no PATH do agente:** wrappers de `git`, build e test que compactam a saída. Funciona com qualquer agente, e o ADE controla o PATH ao lançar o agente.
2. **Hooks nativos de cada agente** (Claude Code e Copilot têm mecanismos próprios).
3. **Ferramentas MCP** que já devolvem saída enxuta.

Manter um modo "raw" para diagnóstico e medir tokens economizados por comando.

### 4.4 Vault e second brain corporativos

- Adotar o **modelo do §5 do plano do time**: hierarquia empresa → tribo → produto → squad → projeto, precedência, frontmatter com status, resolver que monta o contexto mínimo.
- Implementar como **serviço com API versionada**, exposto aos agentes por **MCP**. Funciona no ADE, no VS Code e no CLI.
- Pré-configurado em todos os agentes pelo bootstrap do ADE.

### 4.5 Fluxo padrão SDD / AIDLC

Plugin com painel wizard:
1. **Spec:** template guiado, salvo no repositório.
2. **Plano:** gerado pelo agente e aprovado pelo dev.
3. **Tarefas:** cada tarefa vira uma worktree.
4. **Execução:** agentes em paralelo.
5. **Revisão:** diff, testes e PR.

Skills e templates versionados no vault, utilizáveis também fora do ADE. O hook `agent.prompt.before` injeta a spec aprovada nos prompts disparados pelo wizard.

### 4.6 Migração do Squad Toolkit

1. Inventário: prompts e regras / dependências da API do VS Code / integrações.
2. Prompts e regras → skills e AGENTS.md.
3. Integrações → servidores MCP.
4. UI → painéis do ADE.
5. A extensão de VS Code continua até a paridade.

### 4.7 Canal de novidades

- **Plugins, skills e agentes** pelo catálogo interno: commit fixo, hash, rollout progressivo e rollback.
- **Painel "Novidades"** com changelog, dicas e feedback do dev (dois sentidos), mais um badge na status bar.
- **App** pelo fluxo `internal-manual` assinado (§2.7 do plano do time). Auto-update público continua desligado.

### 4.8 Experiência do dev

- **Zero config:** plugins empacotados, serviços locais e MCP configurados no primeiro uso, versões dos CLIs dos agentes homologadas e fixadas pelo ADE.
- **Modo guiado:** primeira execução com uma tarefa real (SDD → agente → diff → PR) e missões por trilha (Backend/Java, Front, Mobile, QA). Requer patch no núcleo para esconder painéis avançados.
- **Marca visual:** cores, ícones e fontes por plugin de tema; nome, appId, ícone do app e instalador por patch de identidade (STIA-005).

---

## 5. O que manter do plano atual

| Item | Por quê |
|---|---|
| **STIA-002/003/004** — updater desligado por política de build, `DisabledUpdaterService`, `disabled-by-policy`, bloqueio de catálogos upstream, kill list, estatísticas, star prompts e mobile | Diagnóstico correto e mais rigoroso que alternativas por configuração. Já implementado em boa parte |
| **§2.8** — testes de zero chamadas de rede | Evidência objetiva para segurança |
| **STIA-005 + §3.2** — rebranding com checklist anti-colisão | Garante coexistência com o Orca original na mesma máquina |
| **§5** — vault hierárquico e resolver de contexto | Base do vault / second brain (4.4) |
| **§4.3** — nenhum segredo persistente para agentes | Base da credencial por dev no gateway (4.1) |
| **"Worktree não é fronteira de segurança"** | Correto e deve constar na análise de risco |
| **§8 / §12** — gates de CI, PRs pequenos por épico, ADRs, docs | Disciplina necessária para o fork |
| **§14.10** — lista de patches + procedimento de rebase | Alinha com a estratégia da seção 8 |

---

## 6. Onde o código deve ficar

Hoje há código próprio em `src/shared/enterprise` e `src/main/enterprise`, dentro do núcleo. O próprio plano (§5.2) recomenda que o vault tenha API própria, desacoplada do Orca.

| Fica no núcleo (patch) | Sai do núcleo |
|---|---|
| Política de update (`update-policy.ts`, `DisabledUpdaterService`) | `vault-document.ts` e resolver de contexto → **serviço de vault** (API + MCP) |
| Identidade (`squad-toolkit-ia-identity.cjs`, appId, protocolo, caminhos) | `audit-ledger.ts`, `run-budget.ts` → serviço de auditoria e **LiteLLM** (orçamento) |
| Bloqueio de endpoints e catálogos upstream | `access-policy.ts`, `governance-scope.ts` → LiteLLM (política por dev/repo) e plugin com hooks `onError: "deny"` |
| Desligamento e ocultação de módulos | `agent-run.ts`, `catalog-manifest.ts` → pacote próprio consumido por plugins |
| Pré-aprovação de plugins F2A e catálogo interno exclusivo | — |
| Ganchos mínimos de UI para o modo guiado | — |

Manter uma **lista fechada de patches do núcleo**, cada um com justificativa. Medir na PoC quantos arquivos ela toca: é o indicador de que o rebase continua viável.

---

## 7. Arquitetura-alvo da governança (fase posterior)

O control plane do §6 do plano (API gateway próprio, PDP, catalog service, orchestrator, execution broker, DAG, checkpoints) e o sandbox por execução (STIA-007) são uma **arquitetura-alvo válida**. Mas **não são necessários para entregar o ADE com as vantagens acima** e dependem de infraestrutura do banco (IdP, sandbox, egress). Recomendação:

- **Agora:** política e orçamento no LiteLLM, credencial por dev/repositório, catálogo fechado, auditoria enviada ao SIEM, egress pelo proxy corporativo, decisão de risco documentada sobre a execução local.
- **Depois:** control plane, broker e sandbox, à medida que a necessidade se confirmar e a infraestrutura existir.

O Orca já orquestra agentes locais em worktrees. Um broker remoto com sandboxes muda o modelo de execução do produto e deve ser decidido separadamente.

---

## 8. Estratégia de fork

- **Fila de patches rebaseada periodicamente** sobre tags do upstream, com testes E2E como portão. Os devs recebem um canal estável. Isso permite incorporar melhorias do Orca (inclusive da API de plugins) sem reescrever o fork.
- **Electron:** a versão fixada no código é a 43.8.7, com fim de suporte previsto para o início de 2027. Upgrade de Electron é requisito de segurança.
- **Tag base:** os hooks de plugin exigem Orca ≥ 1.4.248 (≥ 1.4.253 para fontes por plugin). Confirmar se há release estável com isso ou se a base sai do `main`, com o SHA fixado.
- **Inventário de desligamento:** decidir módulo a módulo, por exemplo `browser-passwords`, `computer`, `connector-cloud`, `speech`, servidor web e endpoints de relay/push/share/login em `onorca.dev`. A superfície relevante vai além de shell e git.
- **Publisher dos plugins:** usar um publisher próprio (ex.: `f2a`). Nomes iniciados em `orca` são reservados ao catálogo oficial.

---

## 9. Como medir as vantagens

A rubrica do §11 mantém os **critérios bloqueantes de segurança como portão** de go/no-go. O sucesso do ADE é medido por **vantagem real**:

| Vantagem | Métrica |
|---|---|
| Economia | Consumo roteado pelo LiteLLM; tokens economizados por compactação e otimização de tool calling; custo por tarefa concluída |
| Produtividade | PRs assistidos; tempo da spec ao PR; tarefas paralelas por sessão |
| Qualidade | Testes verdes, retrabalho, PRs rejeitados, taxa de fallback do roteamento |
| Adoção | Ativação (primeiro PR assistido) e uso semanal |
| Padronização | Uso de skills e agentes do catálogo; aderência ao fluxo SDD |

Métricas por dev são dado pessoal de empregado (LGPD). Coletar de forma agregada e alinhar a base legal antes.

---

## 10. Ordem de construção

Por dependência técnica:

1. **Fundação do fork:** tag/SHA base, updater desligado, identidade e anti-colisão (em andamento), inventário e desligamento de módulos, patches de catálogo interno e pré-aprovação.
2. **Caminho de economia:** LiteLLM endurecido + BYOK do Copilot CLI + plugin de integração + compactação F2A no gateway.
3. **Otimização de tool calling** (shim no PATH) e **vault via MCP**.
4. **Plugins de valor:** SDD/AIDLC, Novidades, Onboarding (com os ganchos de UI), Dashboard, tema.
5. **Migração do Squad Toolkit** para skills, MCP e painéis.
6. **Governança avançada** (seção 7), conforme a necessidade.

Os itens 2 e 3 também funcionam no VS Code + Copilot atual. Vale ativá-los lá desde já, para gerar economia e dados de uso antes do ADE.

---

## 11. Decisões técnicas em aberto

1. Nome do produto: **Squad Toolkit IA** ou **Orca F2A**.
2. Tag base do Orca (release estável × `main` com SHA fixado).
3. Ponto exato da compactação F2A no LiteLLM (proxy à frente ou callback interno).
4. Mecanismo da otimização de tool calling: shim no PATH, hooks nativos ou MCP, ou uma combinação.
5. Lista de módulos do núcleo a desligar.
6. A governança multi-tenant do §0/§6 é exigência formal de segurança ou proposta de arquitetura-alvo?

---

## 12. Próximos passos

- [ ] Mover para fora do núcleo o código de `src/*/enterprise` que não precisa estar lá (seção 6) e registrar a lista fechada de patches.
- [ ] Inventário de módulos e endpoints a desligar (seção 8).
- [ ] PoC: Copilot CLI com BYOK → LiteLLM, com compactação F2A e credencial por dev.
- [ ] Spike da otimização de tool calling por shim no PATH.
- [ ] Serviço de vault (API + MCP) a partir do modelo do §5.
- [ ] Primeiro plugin F2A (SDD + integração gateway) no catálogo interno.
- [ ] Atualizar a rubrica conforme a seção 9.
