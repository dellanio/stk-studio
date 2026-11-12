# Orca F2A — Plano do projeto

> ADE (Agentic Development Environment) corporativo do Bradesco, construído como um **hard fork do Orca** (stablyai/orca, MIT) com o **núcleo praticamente intacto** e tudo o que é do F2A entregue como **plugins por cima do núcleo**.

**Dono:** Flow to Advise (F2A) — Software Engineering COE
**Status:** proposta para discussão
**Versão do documento:** 0.1 — 12/11/2026

---

## 1. Resumo executivo

Hoje os devs estão presos ao **VS Code + Copilot** e ao **Squad Toolkit** (extensão de VS Code). Precisamos de uma plataforma visual, agêntica e plug-and-play, onde o F2A consiga empacotar e distribuir as ferramentas de aceleração e de adoção de IA sem que cada dev precise configurar nada.

A proposta tem cinco pontos:

1. **Base:** um hard fork do Orca (ADE desktop com worktrees, agentes em paralelo, git nativo, visualização de código e diffs).
2. **Núcleo intacto:** no código do Orca a gente só **esconde, desliga e troca a marca**. As features do F2A vivem no **sistema de plugins nativo** do Orca (painéis, workers, hooks, status bar, settings, catálogo próprio).
3. **Infraestrutura de IA fora da interface:** gateway/router de LLM, compactação de contexto e otimização de tool calling rodam como sidecars, servindo qualquer agente.
4. **Sem trocar o editor:** edição pesada e debug continuam no VS Code, com um botão "Abrir no VS Code".
5. **Ciclo controlado:** piloto pequeno, métricas de adoção definidas antes do lançamento e um gatilho combinado com a liderança para ampliar o time.

---

## 2. Objetivos e não-objetivos

### Objetivos

- Dar aos devs um **ADE pronto para uso** (zero config), com as ferramentas de IA do banco já integradas.
- **Reduzir custo** de tokens (router para o bolsão, compactação de contexto, RTK).
- **Padronizar o fluxo de trabalho com IA** (SDD / AIDLC) para todos os chapters.
- Criar um **canal direto F2A → devs** para distribuir novidades e coletar feedback.
- **Sair do lock-in** de editor e de harness (Copilot hoje, Claude Code em breve, outros depois).

### Não-objetivos

- **Não** substituir o VS Code como editor principal (edição pesada, debug e extensões de linguagem ficam nele).
- **Não** manter sincronia contínua com o Orca oficial.
- **Não** reescrever agentes/harnesses: usamos os CLIs existentes (Copilot CLI, Claude Code, Goose/OpenCode).

---

## 3. Inventário de features

| #   | Feature                                                                  | Como entra                                                  | Camada               |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------- |
| F1  | **Router de LLM** ("auto" próprio: Copilot ou bolsão de tokens)          | Plugin (hook `agent.launch.before`) + gateway               | Plugin + Sidecar     |
| F2  | **Compactação de contexto** (estilo Headroom)                            | Proxy local (Headroom, Apache 2.0)                          | Sidecar              |
| F3  | **Otimização de tool calling** (estilo RTK)                              | RTK (MIT) + plugin (hook `agent.tool.before`)               | Sidecar + Plugin     |
| F4  | **Vault / second brain corporativo** pré-plugado                         | Servidores MCP pré-configurados                             | Sidecar + Config     |
| F5  | **Canal de update / novidades**                                          | Painel "Novidades" + updater interno + catálogo interno     | Plugin + Patch       |
| F6  | **Fluxo padrão SDD / AIDLC**                                             | Painel wizard + skills + templates                          | Plugin + Skills      |
| F7  | **Migração do Squad Toolkit**                                            | Reempacotado como skills, MCP e painéis                     | Plugin + Skills      |
| F8  | **Git nativo, visualização rápida de código e diffs**                    | Já existe no núcleo do Orca                                 | Núcleo (sem mudança) |
| F9  | **Botão "Abrir no VS Code"** para edição pesada e debug                  | Já existe (editores externos) + comando do plugin           | Núcleo + Plugin      |
| F10 | **Multi-agente** (Copilot CLI hoje, Claude Code em breve)                | Já existe no núcleo (worktrees em paralelo)                 | Núcleo               |
| F11 | **Plataforma plug-and-play agêntica**                                    | Sistema de plugins + catálogo interno do F2A                | Núcleo + Catálogo    |
| F12 | **Marca visual Bradesco / F2A**                                          | Tema via plugin + nome, ícones e appId no build             | Plugin + Patch       |
| F13 | **Zero config para o dev**                                               | Plugins empacotados e pré-aprovados + bootstrap de sidecars | Patch + Plugin       |
| F14 | **Modo guiado** (primeira experiência para quem nunca usou IA)           | Painel de onboarding com missões por trilha                 | Plugin               |
| F15 | **Dashboard de uso e economia** (tokens, router, adoção)                 | Painel + status bar                                         | Plugin               |
| F16 | **Governança e segurança** (telemetria off, catálogo fechado, auditoria) | Patches de configuração + políticas do gateway              | Patch + Sidecar      |

---

## 4. Arquitetura

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ORCA F2A (desktop)                           │
│                                                                      │
│  NÚCLEO ORCA (intacto)            PLUGINS F2A (empacotados)          │
│  - worktrees / agentes paralelos  - f2a.core   (router, RTK, status) │
│  - git nativo / diffs / editor    - f2a.sdd    (wizard SDD/AIDLC)    │
│  - terminais / browser            - f2a.news   (novidades/feedback)  │
│  - sistema de plugins             - f2a.onboarding (modo guiado)     │
│  - "abrir no editor externo"      - f2a.dashboard (uso e economia)   │
│                                   - f2a.theme  (marca visual)        │
│                                   - f2a.squad  (Squad Toolkit)       │
└───────────────┬──────────────────────────────────────────────────────┘
                │ inicia agentes CLI (comando + env definidos pelo router)
     ┌──────────┴───────────┬─────────────────────────┐
     ▼                      ▼                         ▼
 Copilot CLI           Claude Code (breve)      Goose / OpenCode
 (caminho Copilot)     (caminho Claude)         (caminho bolsão)
     │                      │                         │
     │                      └──────────┬──────────────┘
     │                                 ▼
     │                    SIDECARS LOCAIS (bootstrap automático)
     │                    - Headroom proxy (compactação)
     │                    - RTK (saída de comandos)
     │                    - MCP: vault / second brain / Squad Toolkit
     │                                 │
     ▼                                 ▼
 Backend GitHub Copilot        GATEWAY LLM CORPORATIVO
 (políticas enterprise)        - roteamento / fallback
                               - auditoria / DLP / custo por tribo
                               - bolsão de tokens (parceiro)
```

### Princípios

1. **O núcleo não sabe que o F2A existe.** Tudo o que é F2A entra pelos pontos de extensão oficiais.
2. **Infraestrutura de IA independe da interface.** Gateway, Headroom, RTK e MCP funcionam com o Orca F2A, com o VS Code ou com o CLI puro.
3. **Contexto portável.** Skills, AGENTS.md e MCP valem para Copilot, Claude Code e qualquer agente futuro.
4. **Governança no gateway e nos managed settings dos agentes**, não na interface.

---

## 5. O sistema de plugins do Orca (base técnica)

Lido diretamente no código e na documentação do repositório (`docs/reference/plugin-*.md`). Esses são os pontos de extensão que usamos:

| Recurso                                                                                     | Para que usamos                                                                                                                               |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perfis de execução**: `data`, `declarative`, `sandboxed-ui`, `trusted-worker`             | Tema (`data`); painéis (`sandboxed-ui`); router, RTK e integrações (`trusted-worker`)                                                         |
| **Painéis** na barra lateral (HTML ou componentes TSX sem build)                            | SDD, Novidades, Onboarding, Dashboard, Squad                                                                                                  |
| **Worker** (processo Node separado, com API do host)                                        | Lógica do router, leitura de settings e secrets, eventos de agentes                                                                           |
| **Hooks** (até 8 por plugin)                                                                | `agent.launch.before` (router), `agent.tool.before` (RTK), `agent.prompt.before` (contexto SDD), `workspace.create.after` (setup da worktree) |
| **Eventos**                                                                                 | `agent.status.changed`, `workspace.created` (métricas e dashboard)                                                                            |
| **Status bar**                                                                              | Agente/modelo ativo, tokens economizados, novidades não lidas                                                                                 |
| **Settings declarados**                                                                     | URL do gateway, política do router, trilha do dev                                                                                             |
| **Secrets por plugin**                                                                      | Credenciais do gateway e do bolsão                                                                                                            |
| **Temas** (app, terminal, ícones) e **language packs**                                      | Marca visual e pt-BR                                                                                                                          |
| **Catálogo próprio** (`orca plugin catalog add`), com commit fixo e hash SHA-256 verificado | Distribuição controlada dos plugins F2A                                                                                                       |
| **Plugins empacotados** (`bundled-plugins.json`)                                            | Plugins F2A pré-instalados e pré-aprovados (zero config)                                                                                      |
| **Aprovação + log de auditoria**                                                            | Rastreabilidade para segurança                                                                                                                |

### Limitações conhecidas (e como contornamos)

| Limitação                                                                                   | Contorno                                                                                                             |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `agent.prompt.before` **não intercepta prompts digitados pelo dev**, só os que o Orca envia | O contexto do second brain e do SDD entra por **MCP e skills**, não por hook                                         |
| `agent.tool.after` **não modifica a saída** da ferramenta                                   | A compactação de saída fica no **RTK e no Headroom** (sidecar), não no hook                                          |
| Hook com mais de **2 s** é tratado como "passou"                                            | O router decide com dados em cache (cota, regras); nenhuma chamada lenta antes de decidir                            |
| Plugins `trusted-worker` pedem aprovação do usuário                                         | No fork, os plugins F2A vêm **empacotados e pré-aprovados**                                                          |
| Restaurar sessão salva **não passa** por `agent.launch.before`                              | O env do gateway também é configurado globalmente pelo bootstrap                                                     |
| A API de plugins é **v1 e recente**                                                         | Escolher a tag base com cuidado (precisa de hooks e status bar, ≥ 1.4.248). Congelar a API é bom para a estabilidade |
| Pontos `skills` e `mcpServers` no manifesto ainda são **reservados**                        | Skills e MCP são distribuídos pelo bootstrap do F2A até o formato ser definido                                       |

---

## 6. Detalhamento das features

### F1 — Router de LLM ("auto" do F2A)

**Problema:** o bolsão do parceiro serve os **mesmos modelos do Copilot a um custo menor**. Queremos decidir, por tarefa, se ela vai para o bolsão ou para o Copilot.

**Onde a decisão acontece:** não dá para interceptar o "auto" interno do Copilot, porque as chamadas dele vão direto ao backend do GitHub. Por isso o router decide **qual agente iniciar e com qual configuração**, no hook `agent.launch.before`:

- **Caminho Copilot:** inicia o Copilot CLI normalmente.
- **Caminho bolsão:** inicia um agente agnóstico de modelo (Goose/OpenCode, ou Claude Code quando chegar) com `env` apontando para o gateway corporativo (via Headroom).

**Sinais de decisão, em ordem de prioridade:**

1. **Sensibilidade do repositório.** Repo classificado como sensível só usa provedores homologados para ele.
2. **Cota do Copilot.** Se o contrato é por assento com cota incluída, a chamada ao Copilot custa zero na margem. O bolsão entra quando a cota aperta. _(Depende do modelo de cobrança do contrato; ver Decisões em aberto.)_
3. **Tipo de tarefa.** Testes, documentação, explicação e refatoração local vão para o bolsão. Tarefa agêntica multi-arquivo e arquitetura vão para o Copilot (ajustável por métricas).
4. **Fallback.** Falhou build, teste ou lint no caminho do bolsão: a tarefa sobe para o Copilot.

**Evolução:** fase 1 com **regras explícitas** e log de cada decisão e resultado. Em 4 a 6 semanas, calibrar com os dados reais (qualidade por tipo de tarefa). Só depois considerar um classificador.

**Métrica certa:** custo **por tarefa concluída**, não por token.

### F2 — Compactação de contexto (Headroom)

- **Headroom** (Apache 2.0) como proxy local compatível com OpenAI e Anthropic, entre o agente e o gateway.
- Compressão reversível: os originais ficam guardados localmente e o modelo pode recuperá-los sob demanda.
- Roda no bootstrap do F2A. O router injeta `*_BASE_URL` apontando para o proxy.
- **Validar no piloto:** a economia real nos repos do banco (Java, front) e se há regressão de qualidade.

### F3 — Otimização de tool calling (RTK)

- **RTK** (MIT) comprime a saída de git, build, testes, ls etc. antes de chegar ao modelo.
- **Duas camadas:** hooks nativos do RTK nos agentes que suportam (Claude Code, Copilot no VS Code) e o hook `agent.tool.before` do plugin `f2a.core` para reescrever comandos de shell dentro do Orca.
- Atenção: no **Copilot CLI**, o RTK funciona por "negar e sugerir" (limitação do CLI), não por reescrita transparente.
- **Ganho rápido:** o RTK pode ser distribuído **já no VS Code atual**, antes do Orca F2A.

### F4 — Vault / second brain corporativo

- O vault de conhecimento e o second brain corporativo são expostos como **servidores MCP**.
- O bootstrap do F2A registra esses MCPs em todos os agentes (Copilot CLI, Claude Code, Goose/OpenCode). **Nenhum dev configura nada.**
- Conteúdo inicial: padrões técnicos dos chapters, ADRs, catálogo de APIs internas, guidelines do BEX, playbooks do F2A.
- **Segurança:** acesso de leitura; conteúdo vindo de fontes internas curadas (risco de prompt injection via contexto).

### F5 — Canal de update e novidades

Três canais complementares:

1. **Updater interno** do app: troca o feed de update do GitHub por um servidor do banco, com builds assinados pelo banco.
2. **Catálogo interno de plugins:** novas versões dos plugins F2A sem precisar de uma nova versão do app.
3. **Painel "Novidades" (`f2a.news`):** changelog, dicas, novas skills e missões, com badge na status bar. Funciona **nos dois sentidos**, com botão de feedback e registro de onde o dev travou.

### F6 — Fluxo padrão SDD / AIDLC

Painel wizard `f2a.sdd`:

1. **Spec:** template guiado (contexto, critérios de aceite, restrições).
2. **Plano:** agente gera o plano técnico, o dev revisa e aprova.
3. **Tarefas:** quebra em tarefas, cada uma vira uma worktree.
4. **Execução:** agentes em paralelo (o router decide o caminho de cada tarefa).
5. **Revisão:** diff anotado, testes e PR.

- Os templates e as skills do SDD são versionados no Git e funcionam também fora do Orca (Copilot no VS Code, Claude Code).
- O hook `agent.prompt.before` injeta a spec aprovada nos prompts que o Orca dispara.

### F7 — Migração do Squad Toolkit

1. **Inventário:** o que é prompt/regra, o que depende de API do VS Code (webviews, comandos) e o que é integração.
2. **Prompts e regras** → skills e AGENTS.md (portáveis).
3. **Integrações** → servidores MCP.
4. **UI** → painéis no plugin `f2a.squad`.
5. **Convivência:** a extensão de VS Code continua até a paridade.

### F8, F9, F10 — Git, código, VS Code e multi-agente (núcleo)

- Já existem no Orca: worktree por tarefa, agentes em paralelo, source control (diff, edição rápida, commit), editor embutido, busca, browser.
- **Escopo:** visualização rápida e revisão no Orca F2A. **Edição pesada e debug: botão "Abrir no VS Code"** (editores externos do núcleo + comando do plugin).
- **Agentes suportados no lançamento:** Copilot CLI. Claude Code assim que for liberado. Goose ou OpenCode para o caminho do bolsão.
- **Regra de escopo:** se aparecer pedido de debugger, refactor de IDE ou plugins de linguagem dentro do Orca F2A, a resposta é VS Code.

### F11 — Plataforma plug-and-play

- **Catálogo interno F2A** (repositório Git interno + `orca-catalog.json`) com commit fixo e hash de cada release.
- **Convenção dos plugins F2A:**
  - prefixo `f2a.`;
  - perfil mínimo necessário (preferir `sandboxed-ui`; `trusted-worker` só quando precisa de hook ou worker);
  - capabilities declaradas e revisadas por segurança;
  - testes antes de publicar no catálogo.
- Outras áreas do banco podem publicar plugins no catálogo, com revisão do F2A.

### F12 — Marca visual

| Item                                         | Onde                                                                              | Mexe no núcleo?         |
| -------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------- |
| Cores (claro e escuro), editor, terminal     | Plugin `f2a.theme` (`contributes.themes`, `terminalThemes`)                       | Não                     |
| Ícones de arquivo                            | Plugin (`iconThemes`)                                                             | Não                     |
| Fontes                                       | Plugin (`contributes.fonts`)                                                      | Não                     |
| pt-BR                                        | Language pack (o Orca já tem pt-BR)                                               | Não                     |
| Nome do app, appId, ícone do app, instalador | `config/electron-builder.config.cjs` (`productName`, `appId`), `resources/build/` | Sim (patch de branding) |
| Splash, logo na UI, textos "Orca"            | Arquivos de recursos e i18n                                                       | Sim (patch de branding) |

### F13 — Zero config

Na primeira execução, o bootstrap do F2A:

1. Instala e inicia os sidecars (Headroom, RTK, MCPs).
2. Configura os agentes (MCP, skills, env do gateway, hooks do RTK).
3. Fixa as versões dos CLIs dos agentes homologadas pelo F2A.
4. Abre o modo guiado (F14).

Os plugins F2A vêm **empacotados e pré-aprovados** no build.

### F14 — Modo guiado (adoção)

Disponibilidade de ferramenta não gera adoção sozinha. Quem nunca usou IA trava em confiança, regra, habilidade e incentivo, não em configuração.

- **Primeira execução guiada:** escolher uma tarefa real do backlog, passar pelo wizard SDD, rodar um agente, revisar o diff com explicação e abrir o PR, em uns 15 minutos.
- **Missões por trilha** (Backend/Java, Front, Mobile, QA), definidas com os chapter leads.
- Painéis avançados (paralelismo, router manual) ficam escondidos até o dev pedir.

### F15 — Dashboard

- **Para o dev:** tokens economizados (Headroom + RTK), decisões do router, tarefas concluídas.
- **Para o F2A e a liderança** (agregado, sem conteúdo de código): ativação, uso semanal, PRs assistidos, custo por tribo, taxa de fallback do router.

### F16 — Governança e segurança

- **Telemetria do Orca desligada e travada** (PostHog, crash reporting).
- **Catálogos oficial e da comunidade removidos.** Só o catálogo interno.
- **Companion mobile e integrações não usadas desligados** (Linear etc.).
- **Gateway:** auditoria, DLP, retenção e custo por tribo.
- **Managed settings dos agentes:** Copilot (enterprise managed settings, bloqueio de "yolo mode") e Claude Code.
- **Supply chain:** builds assinados pelo banco, dependências congeladas, plugins com hash verificado.

---

## 7. Mudanças no núcleo (lista fechada de patches)

**Regra:** toda mudança no código do Orca entra nesta lista, com dono e justificativa. **Meta: no máximo ~10 patches**, reaplicáveis em poucos dias num re-fork.

| #   | Patch                                                                   | Tipo          |
| --- | ----------------------------------------------------------------------- | ------------- |
| P1  | Branding: `productName`, `appId`, ícones, instalador, splash            | Troca         |
| P2  | Plugins F2A empacotados e pré-aprovados (`bundled-plugins.json`)        | Configuração  |
| P3  | Catálogo interno como único; oficial e da comunidade removidos          | Configuração  |
| P4  | Telemetria e crash reporting desligados e travados                      | Desligar      |
| P5  | Feed do updater apontando para o servidor interno + assinatura do banco | Troca         |
| P6  | Companion mobile e integrações não usadas desligados ou escondidos      | Esconder      |
| P7  | Bootstrap dos sidecars F2A na inicialização                             | Adição mínima |
| P8  | Política: plugins `trusted-worker` só do catálogo F2A                   | Configuração  |

Todo o resto (router, RTK, SDD, novidades, onboarding, dashboard, tema, Squad) é **plugin ou sidecar**.

---

## 8. Estratégia de fork e manutenção

- **Hard fork**, sem sincronização contínua. Base em uma **tag estável** (não o `main`), com a API de plugins necessária (≥ 1.4.248).
- **Re-fork pontual a cada 6 a 12 meses**, ou cherry-pick quando o upstream trouxer algo que valha.
- **Por que o re-fork fica barato:** o código do F2A está todo em plugins e sidecars, e os patches do núcleo são uma lista curta e documentada (seção 7).
- **Ensaio na PoC:** aplicar os patches em duas tags diferentes do Orca e medir o tempo. Esse número valida o ciclo.

**O que muda mesmo com o fork congelado** (e exige manutenção recorrente):

| Dependência                                 | Ação                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Electron/Chromium (patches de segurança)    | Upgrade planejado, trimestral                                          |
| CLIs dos agentes (Copilot CLI, Claude Code) | Versões fixadas pelo F2A e atualizadas só após testes de contrato      |
| SO e endpoint do banco                      | Testes nos perfis de máquina padrão                                    |
| Fluxos críticos                             | Testes E2E: criar worktree → agente → diff → commit → abrir no VS Code |

---

## 9. Roadmap

### Fase 0 — Ganhos rápidos no ambiente atual (semanas 1 a 4)

Serve para gerar valor e crédito político antes do Orca F2A existir.

- RTK distribuído no VS Code + Copilot.
- Primeiras skills do SDD e AGENTS.md por trilha.
- MCP do second brain/vault em piloto.

### Fase 1 — PoC técnica (semanas 1 a 2, em paralelo à fase 0)

- Fork na tag escolhida + patches P1 a P4.
- Plugin de prova com um **painel SDD** e um **hook `agent.launch.before`** roteando entre o Copilot CLI e um agente apontando para o gateway.
- Medir: linhas tocadas no núcleo e tempo de reaplicar os patches em outra tag.
- **Em paralelo:** due diligence do bolsão (jurídico e compliance) e abertura da conversa com segurança da informação.

### Fase 2 — MVP para piloto (semanas 3 a 8)

- Plugins `f2a.core` (router v1 por regras + RTK), `f2a.sdd`, `f2a.news`, `f2a.onboarding`, `f2a.theme`.
- Sidecars: Headroom, gateway, MCPs.
- Updater interno, catálogo interno, testes E2E.
- **Piloto em 1 ou 2 tribes**, com chapter leads engajados.

### Fase 3 — Calibração (semanas 9 a 14)

- Router calibrado com dados reais.
- `f2a.dashboard`, `f2a.squad` (migração do Squad Toolkit).
- Claude Code integrado (quando liberado).
- Avaliação contra o gatilho de sucesso (seção 10).

### Fase 4 — Expansão (após o gatilho)

- Rollout por ondas de tribes.
- Time ampliado conforme o acordo com a liderança.
- Catálogo aberto para outras áreas publicarem plugins.

---

## 10. Métricas e gatilho de sucesso

**Baseline (coletar antes de tudo):** uso ativo semanal do Copilot hoje, por tribo.

| Métrica            | Definição                                                                          |
| ------------------ | ---------------------------------------------------------------------------------- |
| Ativação           | % de devs do piloto com o primeiro PR assistido                                    |
| Uso semanal        | % de devs com pelo menos N sessões de agente por semana                            |
| Tarefas concluídas | PRs assistidos por dev por mês                                                     |
| Economia           | Custo por tarefa concluída (antes × depois) e tokens economizados (Headroom + RTK) |
| Qualidade          | Taxa de fallback do router, retrabalho, PRs rejeitados                             |
| Satisfação         | NPS / feedback do painel de Novidades                                              |

**Gatilho para ampliar o time (a combinar com a liderança antes do piloto):**

> Exemplo: ≥ X% de uso semanal e ≥ Y PRs assistidos por dev em 90 dias no piloto → entram N pessoas no time de plataforma.

---

## 11. Time e papéis

| Papel                                                          | Fase piloto    | Após o gatilho |
| -------------------------------------------------------------- | -------------- | -------------- |
| Engenharia de plataforma (fork, build, updater, E2E, Electron) | 2              | 3 a 4          |
| Plugins e UX (SDD, onboarding, dashboard, novidades)           | 1 a 2          | 2 a 3          |
| IA/infra (gateway, router, Headroom, MCP)                      | 1              | 2              |
| Adoção (F2A + chapter leads: missões, trilhas, feedback)       | Time F2A atual | Time F2A atual |

**Atenção:** sem um dono nomeado do fork, ele vira legado em poucos meses. O piloto deve ser **limitado ao que o time consegue sustentar**.

---

## 12. Riscos

| Risco                                                                                      | Impacto                      | Mitigação                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| Origem do bolsão (revenda × contrato legítimo), termos de uso, dados passando por terceiro | Alto (compliance BACEN/LGPD) | Due diligence antes de rotear qualquer código; Res. CMN 4.893          |
| Homologação de segurança de um app Electron com acesso a shell e git                       | Alto                         | Conversa com segurança na fase 1; builds assinados; catálogo fechado   |
| Time pequeno para manter o fork                                                            | Alto                         | Núcleo intacto, patches mínimos, piloto limitado, gatilho de ampliação |
| CLIs dos agentes mudando e quebrando adaptadores                                           | Médio                        | Versões fixadas + testes de contrato                                   |
| Electron sem patch de segurança                                                            | Médio                        | Upgrade trimestral                                                     |
| Adoção baixa entre quem nunca usou IA                                                      | Alto                         | Modo guiado, missões, chapter leads, métricas desde o dia 1            |
| Escopo virar "reconstruir o VS Code"                                                       | Médio                        | Regra de escopo: edição pesada e debug = VS Code                       |
| Prompt injection via contexto (vault, recipes, skills)                                     | Médio                        | Fontes curadas, catálogo assinado, revisão de plugins                  |
| Router opaco derrubando a confiança                                                        | Médio                        | Regras explícitas, logs, indicação visível do caminho usado            |

---

## 13. Decisões em aberto

1. **Bolsão:** de onde vem o desconto (contrato direto com Microsoft/AWS/Azure ou revendedor)? Onde ficam os dados? O parceiro treina modelos com eles?
2. **Contrato do Copilot:** por assento com cota fixa, ou com cobrança por excedente de premium requests? (Define a regra 2 do router.)
3. **Agente do caminho do bolsão:** Goose ou OpenCode? (Decidir na PoC.)
4. **Gateway:** LiteLLM, Portkey, Kong AI ou solução interna existente?
5. **Tag base do Orca** para o fork.
6. **Tribo(s) piloto** e chapter leads responsáveis.
7. **Gatilho de sucesso** e tamanho da ampliação do time, combinados com a liderança.
8. **Dono do fork** (nome).

---

## 14. Próximos passos imediatos

- [ ] Levantar o baseline de uso do Copilot por tribo.
- [ ] Abrir a due diligence do bolsão com jurídico e compliance.
- [ ] Abrir a conversa com segurança da informação sobre o Orca F2A.
- [ ] Escolher a tag base e rodar a PoC (painel SDD + hook do router + ensaio de re-fork).
- [ ] Distribuir o RTK e as primeiras skills de SDD no VS Code atual (fase 0).
- [ ] Definir a tribo piloto e o gatilho de sucesso com a liderança.

---

### Referências

- Orca: https://github.com/stablyai/orca — documentação de plugins em `docs/reference/plugin-*.md`
- Headroom: https://github.com/chopratejas/headroom
- RTK: https://github.com/rtk-ai/rtk
- Goose (Linux Foundation / AAIF): https://goose-docs.ai
- GitHub Copilot — enterprise managed settings: https://github.blog/changelog/2026-07-27-enterprise-managed-settings-now-apply-to-the-github-copilot-app
