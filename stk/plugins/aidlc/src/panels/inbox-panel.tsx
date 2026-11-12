// Caixa de Entrada do PO: perguntas enviadas pelos devs em todos os projetos configurados, lidas e
// respondidas pela API do GitHub (sem clonar), com o status das fases em linguagem de negócio.
import {
  atom,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Heading,
  IconButton,
  Input,
  KeyValue,
  plugin,
  Progress,
  read,
  RelativeTime,
  Row,
  set,
  Spinner,
  Stack,
  Tab,
  Tabs,
  Text,
  update,
  type PanelContext
} from 'orca'
import type { ConfigStatus, InboxItem, InboxResult } from '../protocol'
import { errorMessage } from './panel-errors'
import { answerFromDraft, draftFromQuestion, QuestionForm, type AnswerDraft } from './question-form'

const inbox = atom<InboxResult | null>(null)
const config = atom<ConfigStatus | null>(null)
const loading = atom(false)
const busy = atom(false)
const failure = atom<string | null>(null)
const flash = atom<string | null>(null)
const tab = atom('inbox.tab', 'pending', { persist: 'plugin' })
const drafts = atom<Record<string, AnswerDraft>>({})
const githubToken = atom('')
const jiraToken = atom('')

async function load(refresh: boolean): Promise<void> {
  set(loading, true)
  set(failure, null)
  try {
    set(inbox, await plugin.request('inbox.load', { refresh }, { timeoutMs: 120_000 }))
    set(config, await plugin.request('config.status', {}))
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(loading, false)
  }
}

async function answer(item: InboxItem): Promise<void> {
  const question = item.question
  if (!question) {
    return
  }
  const draft = read(drafts)[item.key] ?? draftFromQuestion(question)
  set(busy, true)
  set(failure, null)
  try {
    set(
      inbox,
      await plugin.request(
        'inbox.answer',
        { itemKey: item.key, answer: answerFromDraft(question, draft) },
        { timeoutMs: 120_000 }
      )
    )
    set(flash, `Resposta enviada para ${item.projectLabel}. O dev recebe pelo repositório.`)
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(busy, false)
  }
}

async function saveSecret(key: 'githubToken' | 'jiraToken'): Promise<void> {
  const value = read(key === 'githubToken' ? githubToken : jiraToken)
  set(busy, true)
  try {
    set(config, await plugin.request('config.setSecret', { key, value }))
    set(key === 'githubToken' ? githubToken : jiraToken, '')
    set(flash, value.trim() ? 'Token salvo nos segredos do plugin.' : 'Token removido.')
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(busy, false)
  }
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(
    plugin.on('inbox.changed', () => {
      void plugin.request('inbox.load', { refresh: false }).then((result) => set(inbox, result))
    })
  )
  void load(false)
}

function PendingItem({ item }: { item: InboxItem }) {
  const question = item.question
  return (
    <Card
      title={item.delegation.questionTitle}
      description={`${item.projectLabel} · ${item.phaseLabel} · ${item.stageLabel}`}
    >
      <Stack gap="sm">
        <Text size="sm" muted>
          {`Pedida por ${item.delegation.requestedBy} · esperando há `}
          <RelativeTime at={Date.parse(item.delegation.requestedAt)} format="duration" />
        </Text>
        {item.delegation.note ? (
          <Callout tone="neutral" icon="info" title="Observação do dev">
            {item.delegation.note}
          </Callout>
        ) : null}
        {!question ? (
          <Callout tone="warning">
            A pergunta não está mais no arquivo. Fale com o dev que pediu.
          </Callout>
        ) : question.rawAnswer !== null ? (
          <Callout tone="success" icon="check" title="Já respondida no arquivo">
            {question.rawAnswer}
          </Callout>
        ) : (
          <QuestionForm
            question={question}
            draft={read(drafts)[item.key] ?? draftFromQuestion(question)}
            busy={read(busy)}
            saveLabel="Responder"
            onDraft={(draft) => update(drafts, (all) => ({ ...all, [item.key]: draft }))}
            onSave={() => void answer(item)}
          />
        )}
      </Stack>
    </Card>
  )
}

function PendingTab({ result }: { result: InboxResult }) {
  if (!result.configured) {
    return (
      <EmptyState
        icon="settings"
        title="Nenhum projeto configurado"
        description="Informe seus projetos (owner/repo@branch) em Configurações → Plugins → STK AIDLC, ou ligue o modo demonstração."
      />
    )
  }
  if (result.items.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="Tudo respondido"
        description="Nenhuma pergunta aguardando você."
      />
    )
  }
  return (
    <Stack gap="md">
      {result.items.map((item) => (
        <PendingItem key={item.key} item={item} />
      ))}
    </Stack>
  )
}

function ProjectsTab({ result }: { result: InboxResult }) {
  if (result.projects.length === 0) {
    return <EmptyState icon="folder" title="Nenhum projeto lido ainda" />
  }
  return (
    <Stack gap="md">
      {result.projects.map((project) => (
        <Card key={project.projectLabel} title={project.projectLabel}>
          <Stack gap="sm">
            {project.error ? <Callout tone="danger">{project.error}</Callout> : null}
            {project.records.map((record) => (
              <Stack key={record.root} gap="xs">
                <Row justify="between">
                  <Text weight="medium">{record.label}</Text>
                  {record.pendingQuestions > 0 ? (
                    <Badge tone="warning">{`${record.pendingQuestions} pergunta(s) em aberto`}</Badge>
                  ) : (
                    <Badge tone="success">Sem perguntas em aberto</Badge>
                  )}
                </Row>
                {record.phases
                  .filter((phase) => phase.total > 0)
                  .map((phase) => (
                    <Stack key={phase.id} gap="xs">
                      <Row justify="between">
                        <Text size="sm">{phase.label}</Text>
                        <Text size="sm" muted>{`${phase.done}/${phase.total}`}</Text>
                      </Row>
                      <Progress label={phase.label} labelHidden value={phase.percent} />
                    </Stack>
                  ))}
              </Stack>
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}

function ConfigTab() {
  const status = read(config)
  if (!status) {
    return <Spinner label="Lendo configurações" />
  }
  return (
    <Stack gap="md">
      <KeyValue
        items={[
          {
            label: 'Modo demonstração',
            value: status.demo ? 'Ligado' : 'Desligado',
            tone: status.demo ? 'warning' : 'neutral'
          },
          {
            label: 'Projetos',
            value: status.projects.length > 0 ? status.projects.join(', ') : 'Nenhum'
          },
          {
            label: 'Token do GitHub',
            value: status.githubTokenSet ? 'Configurado' : 'Não configurado',
            tone: status.githubTokenSet ? 'success' : 'warning'
          },
          {
            label: 'Token do Jira',
            value: status.jiraTokenSet ? 'Configurado' : 'Não configurado',
            tone: status.jiraTokenSet ? 'success' : 'neutral'
          }
        ]}
      />
      {!status.secretsAvailable ? (
        <Callout tone="warning" title="Cofre do sistema indisponível">
          Sem chaveiro do sistema operacional, os tokens não podem ser guardados com segurança.
        </Callout>
      ) : null}
      <Card
        title="Token do GitHub"
        description="Precisa de leitura e escrita de conteúdo nos repositórios dos projetos."
      >
        <Row gap="xs">
          <Input
            label="Token do GitHub"
            labelHidden
            type="password"
            placeholder="ghp_…"
            value={read(githubToken)}
            onChange={(value) => set(githubToken, value)}
          />
          <Button
            disabled={read(busy) || !status.secretsAvailable}
            onPress={() => void saveSecret('githubToken')}
          >
            Salvar
          </Button>
        </Row>
      </Card>
      <Card title="Token do Jira" description="Usado por “Lançar no Jira”.">
        <Row gap="xs">
          <Input
            label="Token do Jira"
            labelHidden
            type="password"
            value={read(jiraToken)}
            onChange={(value) => set(jiraToken, value)}
          />
          <Button
            disabled={read(busy) || !status.secretsAvailable}
            onPress={() => void saveSecret('jiraToken')}
          >
            Salvar
          </Button>
        </Row>
      </Card>
      <Text size="xs" muted>
        Projetos, intervalo de verificação e campos do Jira ficam em Configurações → Plugins → STK
        AIDLC.
      </Text>
    </Stack>
  )
}

export default function InboxPanel() {
  const result = read(inbox)
  const pending = result?.items.length ?? 0
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>Caixa de Entrada</Heading>
        <Row gap="xs">
          {result?.demo ? <Badge tone="warning">Demonstração</Badge> : null}
          <IconButton
            icon="refresh"
            label="Verificar agora"
            disabled={read(loading)}
            onPress={() => void load(true)}
          />
        </Row>
      </Row>
      {result?.checkedAt ? (
        <Text size="xs" muted>
          {'Verificado '}
          <RelativeTime at={result.checkedAt} />
        </Text>
      ) : null}
      {read(failure) ? (
        <Callout tone="danger" title="Não foi possível concluir">
          {read(failure)}
        </Callout>
      ) : null}
      {read(flash) ? (
        <Callout tone="success" icon="check">
          {read(flash)}
        </Callout>
      ) : null}
      {result && result.errors.length > 0 ? (
        <Callout tone="warning" title="Avisos">
          {result.errors.join(' · ')}
        </Callout>
      ) : null}
      {read(loading) && !result ? <Spinner label="Verificando seus projetos" /> : null}
      {result ? (
        <Tabs label="Caixa de Entrada" value={read(tab)} onChange={(value) => set(tab, value)}>
          <Tab value="pending" label={`Pendentes (${pending})`} icon="bell">
            <PendingTab result={result} />
          </Tab>
          <Tab value="projects" label="Projetos" icon="folder">
            <ProjectsTab result={result} />
          </Tab>
          <Tab value="config" label="Ajustes" icon="settings">
            <ConfigTab />
          </Tab>
        </Tabs>
      ) : null}
    </Stack>
  )
}
