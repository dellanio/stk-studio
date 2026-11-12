// Read-only sections of the dev panel: phase progress, artifacts and delegations.
import { Badge, Button, Card, EmptyState, List, ListItem, Progress, Row, Stack, Text } from 'orca'
import { phaseLabel, stageLabel } from '../domain/business-language'
import type { DevLoadResult } from '../protocol'

const STATUS_TONE = {
  done: 'success',
  'in-progress': 'accent',
  'awaiting-approval': 'warning',
  revising: 'warning',
  pending: 'neutral',
  skipped: 'neutral'
} as const

export function ProgressTab({ result }: { result: DevLoadResult }) {
  if (result.phases.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title="Sem progresso registrado"
        description="aidlc-state.md ainda não tem etapas."
      />
    )
  }
  return (
    <Stack gap="md">
      {result.currentStage ? (
        <Text muted>{`Etapa atual: ${stageLabel(result.currentStage)}`}</Text>
      ) : null}
      {result.phases.map((phase) => (
        <Card
          key={phase.id}
          title={phase.label}
          description={`${phase.done} de ${phase.total} etapas concluídas`}
        >
          <Stack gap="sm">
            <Progress label={phase.label} labelHidden value={phase.percent} />
            <List label={phase.label}>
              {phase.stages.map((stage) => (
                <ListItem key={stage.name} title={stage.label} description={stage.name}>
                  <Badge tone={STATUS_TONE[stage.status]}>{stage.statusLabel}</Badge>
                </ListItem>
              ))}
            </List>
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}

export function ArtifactsTab({
  result,
  onOpen
}: {
  result: DevLoadResult
  onOpen: (path: string) => void
}) {
  const artifacts = result.snapshot?.artifacts ?? []
  if (artifacts.length === 0) {
    return <EmptyState icon="file-text" title="Nenhum artefato gerado ainda" />
  }
  return (
    <List label="Artefatos">
      {artifacts.map((artifact) => (
        <ListItem
          key={artifact.path}
          icon="file-text"
          title={artifact.path.split('/').pop() ?? artifact.path}
          description={`${phaseLabel(artifact.phase)} · ${stageLabel(artifact.stage)}`}
          onPress={() => onOpen(artifact.path)}
        />
      ))}
    </List>
  )
}

export function DelegationsTab({
  result,
  busy,
  onPull
}: {
  result: DevLoadResult
  busy: boolean
  onPull: () => void
}) {
  const delegations = [...(result.snapshot?.delegations ?? [])].sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt)
  )
  return (
    <Stack gap="sm">
      <Row justify="between">
        <Text muted size="sm">
          Respostas do PO chegam pelo repositório.
        </Text>
        <Button variant="outline" size="sm" icon="download" disabled={busy} onPress={onPull}>
          Buscar respostas
        </Button>
      </Row>
      {delegations.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nada enviado ao PO"
          description="Use “Enviar ao PO” numa pergunta pendente."
        />
      ) : (
        <List label="Delegações">
          {delegations.map((item) => (
            <ListItem
              key={item.id}
              icon={item.status === 'answered' ? 'check' : 'bell'}
              title={`${item.questionId} · ${item.questionTitle}`}
              description={`${item.assignedTo} · pedida por ${item.requestedBy}`}
            >
              <Badge
                tone={
                  item.status === 'answered'
                    ? 'success'
                    : item.status === 'pending'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {item.status === 'answered'
                  ? 'Respondida'
                  : item.status === 'pending'
                    ? 'Aguardando'
                    : 'Cancelada'}
              </Badge>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  )
}
