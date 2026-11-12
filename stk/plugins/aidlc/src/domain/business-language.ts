// Business wording for POs (pt-BR). Stage names fall back to the humanized slug.

const PHASES: Record<string, string> = {
  initialization: 'Preparação',
  ideation: 'Fase de ideação',
  inception: 'Fase de entendimento',
  construction: 'Fase de construção',
  operations: 'Fase de operação',
  operation: 'Fase de operação'
}

const STAGES: Record<string, string> = {
  'workspace-scaffold': 'Preparação do espaço',
  'workspace-detection': 'Análise do projeto',
  'state-init': 'Início do acompanhamento',
  'intent-capture': 'Entendimento da intenção',
  'market-research': 'Pesquisa de mercado',
  feasibility: 'Viabilidade',
  'scope-definition': 'Definição de escopo',
  'team-formation': 'Formação do time',
  'rough-mockups': 'Esboços de tela',
  'approval-handoff': 'Aprovação e passagem',
  'reverse-engineering': 'Levantamento do sistema atual',
  'practices-discovery': 'Práticas do time',
  'requirements-analysis': 'Análise de requisitos',
  requirements: 'Análise de requisitos',
  'user-stories': 'Histórias de usuário',
  'refined-mockups': 'Telas refinadas',
  'application-design': 'Desenho da solução',
  'units-generation': 'Divisão em entregas',
  'delivery-planning': 'Planejamento de entregas',
  'workflow-planning': 'Planejamento do fluxo',
  'execution-plan': 'Plano de execução',
  'functional-design': 'Desenho funcional',
  'nfr-requirements': 'Requisitos não funcionais',
  'nfr-design': 'Desenho não funcional',
  'infrastructure-design': 'Desenho de infraestrutura',
  'code-generation': 'Desenvolvimento',
  'build-and-test': 'Build e testes',
  'ci-pipeline': 'Integração contínua',
  'deployment-pipeline': 'Esteira de implantação',
  'environment-provisioning': 'Ambientes',
  'deployment-execution': 'Implantação',
  'observability-setup': 'Monitoramento',
  'incident-response': 'Resposta a incidentes',
  'performance-validation': 'Desempenho',
  'feedback-optimization': 'Melhoria contínua',
  operations: 'Operação'
}

export function stageSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function phaseLabel(phase: string | null): string {
  if (!phase) {
    return 'Projeto'
  }
  return PHASES[phase.toLowerCase()] ?? phase
}

export function stageLabel(stage: string | null): string {
  if (!stage) {
    return ''
  }
  const known = STAGES[stageSlug(stage)]
  if (known) {
    return known
  }
  const words = stage.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: 'Não iniciada',
  'in-progress': 'Em andamento',
  'awaiting-approval': 'Aguardando aprovação',
  revising: 'Em revisão',
  done: 'Concluída',
  skipped: 'Não se aplica'
}
