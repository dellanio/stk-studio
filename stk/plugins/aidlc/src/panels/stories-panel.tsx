// Histórias → Jira: revisar, editar e selecionar as histórias do inception e lançá-las no Jira
// (épico opcional); as chaves voltam para o artefato no repositório.
import {
  atom,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Collapsible,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  plugin,
  read,
  Row,
  Select,
  set,
  Spinner,
  Stack,
  Text,
  Textarea,
  update,
  type PanelContext
} from 'orca'
import type { AidlcStory } from '../domain/aidlc-stories'
import type { StoriesLoadResult, StoriesSource } from '../protocol'
import type { LaunchResult } from '../stores/stories-launch'
import { errorMessage } from './panel-errors'

type StoryEdit = { summary: string; description: string; criteria: string }

const sources = atom<StoriesSource[]>([])
const notice = atom<string | null>(null)
const choice = atom('stories.choice', '', { persist: 'plugin' })
const view = atom<StoriesLoadResult | null>(null)
const edits = atom<Record<string, StoryEdit>>({})
const selected = atom<string[]>([])
const createEpic = atom(false)
const epicTitle = atom('')
const confirming = atom(false)
const outcome = atom<LaunchResult | null>(null)
const loading = atom(false)
const busy = atom(false)
const failure = atom<string | null>(null)

const SEP = '::'

function editOf(story: AidlcStory): StoryEdit {
  return (
    read(edits)[story.id] ?? {
      summary: story.title,
      description: story.description,
      criteria: story.acceptanceCriteria.join('\n')
    }
  )
}

async function loadStories(value: string): Promise<void> {
  const [sourceId, storiesFile] = value.split(SEP)
  if (!sourceId || !storiesFile) {
    return
  }
  set(choice, value)
  set(loading, true)
  set(failure, null)
  set(outcome, null)
  try {
    const result = await plugin.request('stories.load', { sourceId, storiesFile }, { timeoutMs: 120_000 })
    set(view, result)
    set(edits, {})
    set(selected, result.stories.filter((story) => !story.jiraKey).map((story) => story.id))
    const epicName = result.stories.find((story) => story.epic)?.epic
    set(epicTitle, epicName ?? '')
    set(createEpic, !result.epicJiraKey)
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(loading, false)
  }
}

async function loadSources(): Promise<void> {
  set(loading, true)
  set(failure, null)
  try {
    const result = await plugin.request('stories.sources', {}, { timeoutMs: 120_000 })
    set(sources, result.sources)
    set(notice, result.notice)
    const options = result.sources.flatMap((source) => source.storiesFiles.map((file) => `${source.id}${SEP}${file}`))
    const keep = options.includes(read(choice)) ? read(choice) : options[0]
    if (keep) {
      await loadStories(keep)
    }
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(loading, false)
  }
}

async function launch(): Promise<void> {
  const current = read(view)
  if (!current) {
    return
  }
  const chosen = current.stories.filter((story) => read(selected).includes(story.id) && !story.jiraKey)
  set(busy, true)
  set(failure, null)
  set(confirming, false)
  try {
    const { result, reloaded } = await plugin.request(
      'stories.launch',
      {
        sourceId: current.sourceId,
        storiesFile: current.storiesFile,
        stories: chosen.map((story) => {
          const edit = editOf(story)
          return {
            id: story.id,
            summary: edit.summary.trim() || story.title,
            description: edit.description,
            acceptanceCriteria: edit.criteria.split('\n').map((line) => line.trim()).filter(Boolean)
          }
        }),
        newEpic: read(createEpic) && read(epicTitle).trim() ? { summary: read(epicTitle).trim(), description: '' } : null
      },
      { timeoutMs: 120_000 }
    )
    set(outcome, result)
    set(view, reloaded)
    set(selected, [])
    set(createEpic, false)
  } catch (error) {
    set(failure, errorMessage(error))
  } finally {
    set(busy, false)
  }
}

export function setup(_ctx: PanelContext): void {
  void loadSources()
}

function StoryCard({ story }: { story: AidlcStory }) {
  const edit = editOf(story)
  const change = (patch: Partial<StoryEdit>): void => update(edits, (all) => ({ ...all, [story.id]: { ...edit, ...patch } }))
  const isSelected = read(selected).includes(story.id)
  return (
    <Card title={`${story.id} · ${edit.summary}`} description={[story.epic, story.priority].filter(Boolean).join(' · ')}>
      <Stack gap="sm">
        <Row justify="between">
          {story.jiraKey ? (
            <Badge tone="success">{`No Jira: ${story.jiraKey}`}</Badge>
          ) : (
            <Checkbox
              label="Lançar esta história"
              checked={isSelected}
              disabled={read(busy)}
              onChange={(checked) =>
                update(selected, (ids) => (checked ? [...ids, story.id] : ids.filter((id) => id !== story.id)))
              }
            />
          )}
        </Row>
        {edit.description ? <Text size="sm">{edit.description}</Text> : null}
        {edit.criteria ? (
          <List label="Critérios de aceite">
            {edit.criteria
              .split('\n')
              .filter((line) => line.trim())
              .map((line, index) => (
                <ListItem key={String(index)} icon="check" title={line} />
              ))}
          </List>
        ) : (
          <Text size="sm" tone="warning">
            Sem critérios de aceite.
          </Text>
        )}
        {story.jiraKey ? null : (
          <Collapsible title="Editar antes de lançar">
            <Stack gap="sm">
              <Input label="Título" value={edit.summary} onChange={(value) => change({ summary: value })} />
              <Textarea label="Descrição" rows={3} value={edit.description} onChange={(value) => change({ description: value })} />
              <Textarea
                label="Critérios de aceite (um por linha)"
                rows={4}
                value={edit.criteria}
                onChange={(value) => change({ criteria: value })}
              />
            </Stack>
          </Collapsible>
        )}
      </Stack>
    </Card>
  )
}

function Outcome({ result }: { result: LaunchResult }) {
  const keys = [result.epic ? `épico ${result.epic.key}` : null, ...result.created.map((item) => `${item.storyId} → ${item.key}`)]
    .filter(Boolean)
    .join(', ')
  return (
    <Stack gap="xs">
      {keys ? (
        <Callout tone="success" icon="check" title="Lançado no Jira">
          {`${keys}. Chaves gravadas no artefato.`}
        </Callout>
      ) : null}
      {result.failed.length > 0 ? (
        <Callout tone="danger" title="Algumas histórias não foram criadas">
          {result.failed.map((item) => `${item.storyId}: ${item.message}`).join(' · ')}
        </Callout>
      ) : null}
    </Stack>
  )
}

export default function StoriesPanel() {
  const current = read(view)
  const options = read(sources).flatMap((source) =>
    source.storiesFiles.map((file) => ({ value: `${source.id}${SEP}${file}`, label: `${source.label} · ${file.split('/').slice(-2).join('/')}` }))
  )
  const toLaunch = current ? current.stories.filter((story) => read(selected).includes(story.id) && !story.jiraKey).length : 0
  const result = read(outcome)
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>Histórias → Jira</Heading>
        <IconButton icon="refresh" label="Atualizar" disabled={read(loading)} onPress={() => void loadSources()} />
      </Row>
      {read(failure) ? (
        <Callout tone="danger" title="Não foi possível concluir">
          {read(failure)}
        </Callout>
      ) : null}
      {read(loading) && !current ? <Spinner label="Procurando histórias" /> : null}
      {options.length === 0 && !read(loading) ? (
        <EmptyState icon="book" title="Nenhuma história encontrada" description={read(notice) ?? undefined} />
      ) : null}
      {options.length > 0 ? (
        <Select label="Histórias de" value={read(choice)} options={options} onChange={(value) => void loadStories(value)} />
      ) : null}
      {result ? <Outcome result={result} /> : null}
      {current ? (
        <Stack gap="md">
          <Text size="sm" muted>{`Destino: ${current.jiraTarget}`}</Text>
          <Card title="Épico">
            {current.epicJiraKey ? (
              <Stack gap="xs">
                <Badge tone="success">{`Épico no Jira: ${current.epicJiraKey}`}</Badge>
                <Text size="sm" muted>
                  As novas histórias entram nesse épico.
                </Text>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Checkbox label="Criar um épico para estas histórias" checked={read(createEpic)} onChange={(checked) => set(createEpic, checked)} />
                {read(createEpic) ? <Input label="Título do épico" value={read(epicTitle)} onChange={(value) => set(epicTitle, value)} /> : null}
              </Stack>
            )}
          </Card>
          {current.stories.length === 0 ? <EmptyState icon="book" title="O arquivo não tem histórias reconhecidas" /> : null}
          {current.stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
          {read(confirming) ? (
            <Callout tone="warning" title="Confirmar lançamento">
              <Stack gap="sm">
                <Text>{`Criar ${toLaunch} história(s)${read(createEpic) && read(epicTitle).trim() ? ' e 1 épico' : ''} em ${current.jiraTarget}?`}</Text>
                <Row gap="xs" justify="end">
                  <Button variant="ghost" onPress={() => set(confirming, false)}>
                    Cancelar
                  </Button>
                  <Button icon="rocket" disabled={read(busy)} onPress={() => void launch()}>
                    Confirmar
                  </Button>
                </Row>
              </Stack>
            </Callout>
          ) : (
            <Row justify="end">
              <Button icon="rocket" disabled={read(busy) || toLaunch === 0} onPress={() => set(confirming, true)}>
                {`Lançar no Jira (${toLaunch})`}
              </Button>
            </Row>
          )}
        </Stack>
      ) : null}
    </Stack>
  )
}
