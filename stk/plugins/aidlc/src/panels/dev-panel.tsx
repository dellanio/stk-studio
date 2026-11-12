// Painel AIDLC do dev: fases e etapas (aidlc-state.md), perguntas pendentes com formulário,
// "Enviar ao PO", "Avisar o agente para reler" e os artefatos gerados.
import {
  atom,
  Badge,
  Button,
  Callout,
  Card,
  Collapsible,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  on,
  plugin,
  read,
  RelativeTime,
  Row,
  Select,
  set,
  Spinner,
  Stack,
  Tab,
  Tabs,
  Text,
  Textarea,
  update,
  type PanelContext
} from 'orca'
import type { AidlcQuestion } from '../domain/aidlc-questions'
import { phaseLabel, stageLabel } from '../domain/business-language'
import type { DevLoadResult } from '../protocol'
import type { QuestionFileView } from '../stores/aidlc-record-store'
import { answerFromDraft, draftFromQuestion, QuestionForm, type AnswerDraft } from './question-form'
import { errorMessage } from './panel-errors'
import { ArtifactsTab, DelegationsTab, ProgressTab } from './dev-panel-sections'

const data = atom<DevLoadResult | null>(null)
const loading = atom(false)
const busy = atom(false)
const failure = atom<string | null>(null)
const flash = atom<{ tone: 'success' | 'warning'; text: string } | null>(null)
const tab = atom('dev.tab', 'questions', { persist: 'plugin' })
const drafts = atom<Record<string, AnswerDraft>>({})
const delegating = atom<string | null>(null)
const delegateTo = atom('')
const delegateNote = atom('')

const keyOf = (file: string, questionId: string): string => `${file}#${questionId}`

async function run<T>(work: () => Promise<T>, after?: (value: T) => void): Promise<void> {
  set(busy, true)
  set(failure, null)
  try {
    const value = await work()
    after?.(value)
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(busy, false)
  }
}

async function load(recordRoot?: string): Promise<void> {
  set(loading, true)
  set(failure, null)
  try {
    set(data, await plugin.request('dev.load', recordRoot ? { recordRoot } : {}))
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(loading, false)
  }
}

function recordRoot(): string {
  return read(data)?.snapshot?.record.root ?? ''
}

function save(file: QuestionFileView, question: AidlcQuestion): void {
  const draft = read(drafts)[keyOf(file.path, question.id)] ?? draftFromQuestion(question)
  void run(
    () =>
      plugin.request('dev.answer', {
        recordRoot: recordRoot(),
        questionsFile: file.path,
        questionId: question.id,
        answer: answerFromDraft(question, draft)
      }),
    (result) => {
      set(data, result)
      set(flash, { tone: 'success', text: `Resposta de ${question.id} gravada em ${file.path}.` })
    }
  )
}

function startDelegation(file: QuestionFileView, question: AidlcQuestion): void {
  set(delegating, keyOf(file.path, question.id))
  set(delegateTo, read(data)?.defaultAssignee ?? '')
  set(delegateNote, '')
}

function delegate(file: QuestionFileView, question: AidlcQuestion): void {
  void run(
    () =>
      plugin.request(
        'dev.delegate',
        {
          recordRoot: recordRoot(),
          questionsFile: file.path,
          questionId: question.id,
          assignedTo: read(delegateTo),
          note: read(delegateNote)
        },
        { timeoutMs: 120_000 }
      ),
    ({ result, git }) => {
      set(data, result)
      set(delegating, null)
      set(flash, {
        tone: git.pushed ? 'success' : 'warning',
        text: `${question.id} enviada ao PO. ${git.message}`
      })
    }
  )
}

function notifyAgent(file: QuestionFileView): void {
  void run(
    () => plugin.request('dev.notifyAgent', { recordRoot: recordRoot(), questionsFile: file.path }),
    ({ message }) => set(flash, { tone: 'success', text: message })
  )
}

function pull(): void {
  void run(
    () => plugin.request('dev.pull', { recordRoot: recordRoot() }, { timeoutMs: 120_000 }),
    ({ result, message }) => {
      set(data, result)
      set(flash, { tone: 'success', text: message })
    }
  )
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(on('workspace.changed', () => void load()))
  void load()
}

function pendingDelegation(file: QuestionFileView, question: AidlcQuestion) {
  return read(data)?.snapshot?.delegations.find(
    (item) =>
      item.status === 'pending' &&
      item.questionsFile === file.path &&
      item.questionId === question.id
  )
}

function DelegateForm({ file, question }: { file: QuestionFileView; question: AidlcQuestion }) {
  return (
    <Card
      title="Enviar ao PO"
      description="Grava a delegação em .stk/delegations.json e envia ao repositório."
    >
      <Stack gap="sm">
        <Input
          label="Para"
          placeholder="Nome do PO"
          value={read(delegateTo)}
          onChange={(value) => set(delegateTo, value)}
        />
        <Textarea
          label="Observação (opcional)"
          rows={2}
          value={read(delegateNote)}
          onChange={(value) => set(delegateNote, value)}
        />
        <Row justify="end" gap="xs">
          <Button variant="ghost" onPress={() => set(delegating, null)}>
            Cancelar
          </Button>
          <Button icon="upload" disabled={read(busy)} onPress={() => delegate(file, question)}>
            Enviar
          </Button>
        </Row>
      </Stack>
    </Card>
  )
}

function PendingQuestion({
  file,
  question,
  first
}: {
  file: QuestionFileView
  question: AidlcQuestion
  first: boolean
}) {
  const key = keyOf(file.path, question.id)
  const delegation = pendingDelegation(file, question)
  return (
    <Collapsible title={`${question.id} · ${question.title}`} defaultOpen={first}>
      <Stack gap="sm">
        {delegation ? (
          <Row gap="xs">
            <Badge tone="warning">{`Com ${delegation.assignedTo}`}</Badge>
            <Text size="xs" muted>
              enviada <RelativeTime at={Date.parse(delegation.requestedAt)} />
            </Text>
          </Row>
        ) : null}
        <QuestionForm
          question={question}
          draft={read(drafts)[key] ?? draftFromQuestion(question)}
          busy={read(busy)}
          saveLabel="Salvar resposta"
          onDraft={(draft) => update(drafts, (all) => ({ ...all, [key]: draft }))}
          onSave={() => save(file, question)}
        />
        {read(delegating) === key ? (
          <DelegateForm file={file} question={question} />
        ) : (
          <Row justify="start">
            <Button
              variant="outline"
              size="sm"
              icon="upload"
              disabled={read(busy)}
              onPress={() => startDelegation(file, question)}
            >
              {delegation ? 'Reenviar ao PO' : 'Enviar ao PO'}
            </Button>
          </Row>
        )}
      </Stack>
    </Collapsible>
  )
}

function QuestionsTab({ files }: { files: QuestionFileView[] }) {
  const withPending = files.filter((file) =>
    file.questions.some((question) => question.rawAnswer === null)
  )
  const answered = files.flatMap((file) =>
    file.questions
      .filter((question) => question.rawAnswer !== null)
      .map((question) => ({ file, question }))
  )
  return (
    <Stack gap="md">
      {withPending.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nenhuma pergunta pendente"
          description="Todas as perguntas do workflow têm resposta."
        />
      ) : null}
      {withPending.map((file, fileIndex) => (
        <Card
          key={file.path}
          title={`${stageLabel(file.stage)} · ${phaseLabel(file.phase)}`}
          description={file.path}
        >
          <Stack gap="sm">
            {file.questions
              .filter((question) => question.rawAnswer === null)
              .map((question, index) => (
                <PendingQuestion
                  key={question.id}
                  file={file}
                  question={question}
                  first={fileIndex === 0 && index === 0}
                />
              ))}
            <Row justify="end">
              <Button
                variant="ghost"
                size="sm"
                icon="agent"
                disabled={read(busy)}
                onPress={() => notifyAgent(file)}
              >
                Avisar o agente para reler
              </Button>
            </Row>
          </Stack>
        </Card>
      ))}
      {answered.length > 0 ? (
        <Collapsible title={`Respondidas (${answered.length})`}>
          <List label="Perguntas respondidas">
            {answered.map(({ file, question }) => (
              <ListItem
                key={keyOf(file.path, question.id)}
                icon="check"
                title={`${question.id} · ${question.title}`}
                description={question.rawAnswer ?? ''}
              />
            ))}
          </List>
        </Collapsible>
      ) : null}
    </Stack>
  )
}

export default function DevPanel() {
  const result = read(data)
  const files = result?.snapshot?.questionFiles ?? []
  const pending = files.reduce(
    (count, file) => count + file.questions.filter((q) => q.rawAnswer === null).length,
    0
  )
  const message = read(flash)
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>AIDLC</Heading>
        <Row gap="xs">
          {pending > 0 ? <Badge tone="accent">{`${pending} pendente(s)`}</Badge> : null}
          <IconButton
            icon="refresh"
            label="Atualizar"
            disabled={read(loading)}
            onPress={() => void load(recordRoot() || undefined)}
          />
        </Row>
      </Row>
      {read(failure) ? (
        <Callout tone="danger" title="Não foi possível concluir">
          {read(failure)}
        </Callout>
      ) : null}
      {message ? (
        <Callout tone={message.tone} icon={message.tone === 'success' ? 'check' : 'warning'}>
          {message.text}
        </Callout>
      ) : null}
      {read(loading) && !result ? <Spinner label="Lendo aidlc-docs" /> : null}
      {result?.notice ? (
        <EmptyState icon="layers" title="AIDLC" description={result.notice} />
      ) : null}
      {result?.snapshot ? (
        <Stack gap="md">
          {result.records.length > 1 ? (
            <Select
              label="Intenção"
              value={result.snapshot.record.root}
              options={result.records.map((record) => ({
                value: record.root,
                label: record.label
              }))}
              onChange={(value) => void load(value)}
            />
          ) : (
            <Text
              muted
              size="sm"
            >{`${result.workspace?.name ?? ''} · ${result.snapshot.record.label}`}</Text>
          )}
          {result.snapshot.errors.length > 0 ? (
            <Callout tone="warning" title="Arquivos que não consegui ler">
              {result.snapshot.errors.map((error) => `${error.path}: ${error.message}`).join(' · ')}
            </Callout>
          ) : null}
          <Tabs label="Seções do AIDLC" value={read(tab)} onChange={(value) => set(tab, value)}>
            <Tab value="questions" label={`Perguntas (${pending})`} icon="info">
              <QuestionsTab files={files} />
            </Tab>
            <Tab value="progress" label="Progresso" icon="activity">
              <ProgressTab result={result} />
            </Tab>
            <Tab value="artifacts" label="Artefatos" icon="file-text">
              <ArtifactsTab
                result={result}
                onOpen={(path) =>
                  void run(() => plugin.request('dev.openFile', { recordRoot: recordRoot(), path }))
                }
              />
            </Tab>
            <Tab value="delegations" label="PO" icon="bell">
              <DelegationsTab result={result} busy={read(busy)} onPull={pull} />
            </Tab>
          </Tabs>
        </Stack>
      ) : null}
    </Stack>
  )
}
