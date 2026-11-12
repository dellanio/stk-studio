# STK Studio — documentação do projeto

ADE (Agentic Development Environment) corporativo, ponto único de IA e de AIDLC para devs e POs, construído sobre o Orca.

## Upstream

| Item                | Valor                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Repositório         | https://github.com/stablyai/orca                                                                         |
| Commit base         | `08f4f03d39045e010a4057a7d3c4822495f25bbd` (2026-11-12)                                                  |
| Licença             | MIT (preservar `LICENSE` e notices)                                                                      |
| Forma de importação | Snapshot sem histórico (commit `Base:` neste repositório)                                                |
| Atualização         | Fila de patches: diff `Base..HEAD` reaplicado sobre um novo snapshot do upstream, com testes como portão |

## Documentos

| Arquivo                                                      | Conteúdo                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [premissas-e-capacidades.md](premissas-e-capacidades.md)     | **Referência principal:** premissas P1–P12, capacidades C1–C19, restrições técnicas do Orca, desenho por capacidade |
| [recomendacoes-arquitetura.md](recomendacoes-arquitetura.md) | Como usar o Orca para o ADE: arquitetura, APIs nativas, LiteLLM/BYOK, ordem de construção                           |
| [brief-poc-aidlc-modo-po.md](brief-poc-aidlc-modo-po.md)     | Especificação do primeiro PoC: AIDLC + perfis/modo PO + histórias → Jira (C17–C19)                                  |
| [patches.md](patches.md)                                     | Lista fechada de mudanças no núcleo do Orca                                                                         |
| [plano-v0.1-historico.md](plano-v0.1-historico.md)           | Primeira versão do plano (histórico; parcialmente superada)                                                         |
