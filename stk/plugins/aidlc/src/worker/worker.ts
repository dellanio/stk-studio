// The plugin worker: files, git and network for the panels (panels have no network), plus the
// Caixa de Entrada polling behind the status bar badge.
import { fileURLToPath } from 'node:url'
import type { OrcaWorkerApi } from 'orca/worker'
import type { AidlcRecordRef } from '../domain/aidlc-record'
import { createFakeJiraClient, createRestJiraClient, type JiraClient } from '../jira/jira-client'
import type { ConfigStatus, DevLoadResult, InboxResult, StoriesLoadResult, StoriesSource } from '../protocol'
import { createGitHubFileSource, projectLabel } from '../sources/github-file-source'
import { createLocalFileSource } from '../sources/local-file-source'
import { createMemoryFileSource } from '../sources/memory-file-source'
import type { RecordFileSource } from '../sources/record-file-source'
import {
  answerQuestion,
  delegateQuestion,
  discoverRecords,
  loadRecordSnapshot,
  resolveDelegations
} from '../stores/aidlc-record-store'
import { launchStories, readStories } from '../stores/stories-launch'
import { commitAndPush, gitUserName, pullFastForward } from './git-sync'
import { answerInboxItem, collectInbox } from './inbox'
import { readConfig, readSecret, secretsAvailable, type PluginConfig } from './plugin-config'
import { phaseViews } from './record-views'

const PLUGIN_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SELECTED_RECORD = 'dev.recordRoot'
const LAST_INBOX = 'inbox.last'
const SEEN = 'inbox.seen'

type LocalWorkspace = { name: string; branch: string; path: string; workspaceId: string }

export class UserFacingError extends Error {
  readonly code = 'action_failed'
}

let pollTimer: ReturnType<typeof setTimeout> | null = null
let demoSources: RecordFileSource[] | null = null
let demoJira: JiraClient | null = null

async function loadDemoSources(): Promise<RecordFileSource[]> {
  if (demoSources) {
    return demoSources
  }
  const seeds: [string, string][] = [
    ['demo/reembolso-v1@main', 'fixtures/v1'],
    ['demo/reembolso-v2@main', 'fixtures/v2']
  ]
  demoSources = await Promise.all(
    seeds.map(async ([label, dir]) => {
      const fixtures = createLocalFileSource(`${PLUGIN_ROOT}${dir}`, label)
      const files: Record<string, string> = {}
      for (const path of await fixtures.listFiles('')) {
        files[path] = (await fixtures.readFile(path))?.content ?? ''
      }
      return createMemoryFileSource(label, files)
    })
  )
  return demoSources
}

async function projectSources(orca: OrcaWorkerApi, config: PluginConfig): Promise<RecordFileSource[]> {
  if (config.demo) {
    return loadDemoSources()
  }
  if (config.projects.length === 0) {
    return []
  }
  const token = await readSecret(orca, 'githubToken')
  if (!token) {
    throw new UserFacingError('Informe o token do GitHub na aba Configurar da Caixa de Entrada.')
  }
  return config.projects.map((project) =>
    createGitHubFileSource({ project, token, apiUrl: config.githubApiUrl })
  )
}

async function jiraClient(orca: OrcaWorkerApi, config: PluginConfig): Promise<{ client: JiraClient; target: string }> {
  if (config.demo) {
    demoJira ??= createFakeJiraClient('DEMO')
    return { client: demoJira, target: 'Jira simulado (modo demonstração)' }
  }
  const token = await readSecret(orca, 'jiraToken')
  if (!config.jira.baseUrl || !config.jira.projectKey || !token) {
    throw new UserFacingError('Configure URL, projeto e token do Jira antes de lançar.')
  }
  return {
    client: createRestJiraClient({ ...config.jira, token }),
    target: `${config.jira.baseUrl} · ${config.jira.projectKey}`
  }
}

async function focusedWorkspace(orca: OrcaWorkerApi): Promise<LocalWorkspace | { notice: string }> {
  const context = await orca.host.call('workspace.readContext', {})
  if (!context?.workspaceId) {
    return { notice: 'Abra uma workspace para acompanhar o AIDLC.' }
  }
  const { workspaces } = await orca.host.call('workspace.list', {})
  const row = workspaces.find((candidate) => candidate.id === context.workspaceId)
  if (!row) {
    return { notice: 'Não encontrei a pasta da workspace atual.' }
  }
  if (row.hostId && row.hostId !== 'local') {
    return { notice: 'Workspace remota: o STK Studio trabalha só com pastas locais.' }
  }
  return { name: context.displayName, branch: context.branch, path: row.path, workspaceId: row.id }
}

function localSource(workspace: LocalWorkspace): RecordFileSource {
  return createLocalFileSource(workspace.path, workspace.name)
}

async function devAuthor(config: PluginConfig, workspace: LocalWorkspace): Promise<string> {
  return config.userName || (await gitUserName(workspace.path)) || 'Dev'
}

async function loadDev(orca: OrcaWorkerApi, requestedRoot?: string): Promise<DevLoadResult> {
  const config = await readConfig(orca)
  const empty: DevLoadResult = {
    workspace: null,
    notice: null,
    records: [],
    snapshot: null,
    phases: [],
    currentStage: null,
    defaultAssignee: config.defaultPo
  }
  const workspace = await focusedWorkspace(orca)
  if ('notice' in workspace) {
    return { ...empty, notice: workspace.notice }
  }
  const source = localSource(workspace)
  const records = await discoverRecords(source)
  const base = { ...empty, workspace: { name: workspace.name, branch: workspace.branch }, records }
  if (records.length === 0) {
    return { ...base, notice: 'Esta workspace não tem aidlc-docs/ (nem aidlc/spaces/). Inicie o AI-DLC pelo agente.' }
  }
  const stored = requestedRoot ?? ((await orca.storage.get(SELECTED_RECORD)) as string | null)
  const record = records.find((candidate) => candidate.root === stored) ?? records[0]
  if (requestedRoot) {
    await orca.storage.set(SELECTED_RECORD, record.root)
  }
  const snapshot = await loadRecordSnapshot(source, record, config.format)
  return { ...base, snapshot, phases: phaseViews(snapshot.state), currentStage: snapshot.state?.currentStage ?? null }
}

async function requireWorkspace(orca: OrcaWorkerApi): Promise<LocalWorkspace> {
  const workspace = await focusedWorkspace(orca)
  if ('notice' in workspace) {
    throw new UserFacingError(workspace.notice)
  }
  return workspace
}

async function requireRecord(source: RecordFileSource, root: string): Promise<AidlcRecordRef> {
  const record = (await discoverRecords(source)).find((candidate) => candidate.root === root)
  if (!record) {
    throw new UserFacingError(`Registro do AIDLC não encontrado: ${root}`)
  }
  return record
}

function emptyInbox(config: PluginConfig): InboxResult {
  return {
    configured: config.demo || config.projects.length > 0,
    demo: config.demo,
    checkedAt: null,
    items: [],
    projects: [],
    errors: config.invalidProjectLines.map((line) => `Projeto inválido nas configurações: "${line}" (use owner/repo@branch).`)
  }
}

async function refreshInbox(orca: OrcaWorkerApi, notify: boolean): Promise<InboxResult> {
  const config = await readConfig(orca)
  const result = emptyInbox(config)
  if (!result.configured) {
    await updateBadge(orca, result)
    return result
  }
  try {
    const collection = await collectInbox(await projectSources(orca, config), config.format)
    Object.assign(result, collection, { errors: [...result.errors, ...collection.errors] })
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }
  result.checkedAt = Date.now()
  await orca.storage.set(LAST_INBOX, result as never)
  await announceNew(orca, result, notify)
  await updateBadge(orca, result)
  orca.panels.post('inbox.changed', { pending: result.items.length })
  return result
}

async function announceNew(orca: OrcaWorkerApi, result: InboxResult, notify: boolean): Promise<void> {
  const seen = new Set(((await orca.storage.get(SEEN)) as string[] | null) ?? [])
  const fresh = result.items.filter((item) => !seen.has(item.key))
  await orca.storage.set(SEEN, result.items.map((item) => item.key))
  if (!notify || fresh.length === 0) {
    return
  }
  const first = fresh[0]
  await orca.host
    .call('notifications.show', {
      title: fresh.length === 1 ? 'Nova pergunta para o PO' : `${fresh.length} novas perguntas para o PO`,
      body: `${first.projectLabel}: ${first.delegation.questionTitle}`
    })
    .catch(() => undefined)
}

async function updateBadge(orca: OrcaWorkerApi, result: InboxResult): Promise<void> {
  const pending = result.items.length
  await orca.host
    .call('statusBar.update', {
      id: 'inbox',
      visible: result.configured,
      text: pending > 0 ? `PO: ${pending}` : 'PO: 0',
      tone: pending > 0 ? 'accent' : 'neutral',
      tooltip: pending > 0 ? `${pending} pergunta(s) aguardando o PO` : 'Nenhuma pergunta aguardando o PO'
    })
    .catch(() => undefined)
}

function schedulePoll(orca: OrcaWorkerApi): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
  }
  void readConfig(orca).then((config) => {
    pollTimer = setTimeout(async () => {
      await refreshInbox(orca, true).catch((error) => orca.log(`inbox poll failed: ${String(error)}`))
      schedulePoll(orca)
    }, config.pollMinutes * 60_000)
  })
}

async function configStatus(orca: OrcaWorkerApi): Promise<ConfigStatus> {
  const config = await readConfig(orca)
  return {
    githubTokenSet: (await readSecret(orca, 'githubToken')) !== null,
    jiraTokenSet: (await readSecret(orca, 'jiraToken')) !== null,
    secretsAvailable: await secretsAvailable(orca),
    demo: config.demo,
    projects: config.projects.map(projectLabel)
  }
}

async function storiesSourceById(
  orca: OrcaWorkerApi,
  sourceId: string
): Promise<{ source: RecordFileSource; record: AidlcRecordRef; author: string }> {
  const config = await readConfig(orca)
  const [kind, label, root] = sourceId.split('|')
  if (kind === 'local') {
    const workspace = await requireWorkspace(orca)
    const source = localSource(workspace)
    return { source, record: await requireRecord(source, root), author: await devAuthor(config, workspace) }
  }
  const source = (await projectSources(orca, config)).find((candidate) => candidate.label === label)
  if (!source) {
    throw new UserFacingError(`Projeto não configurado: ${label}`)
  }
  return { source, record: await requireRecord(source, root), author: config.userName || 'PO' }
}

async function loadStoriesView(orca: OrcaWorkerApi, sourceId: string, storiesFile: string): Promise<StoriesLoadResult> {
  const { source, record } = await storiesSourceById(orca, sourceId)
  const document = await readStories(source, record, storiesFile)
  const config = await readConfig(orca)
  const target = config.demo
    ? 'Jira simulado (modo demonstração)'
    : config.jira.baseUrl
      ? `${config.jira.baseUrl} · ${config.jira.projectKey || 'projeto não configurado'}`
      : 'Jira não configurado'
  return { sourceId, storiesFile, epicJiraKey: document.epicJiraKey, stories: document.stories, jiraTarget: target }
}

export default function activate(orca: OrcaWorkerApi): void {
  orca.panels.handle('dev.load', ({ recordRoot }) => loadDev(orca, recordRoot))

  orca.panels.handle('dev.answer', async ({ recordRoot, questionsFile, questionId, answer }) => {
    const config = await readConfig(orca)
    const workspace = await requireWorkspace(orca)
    const source = localSource(workspace)
    const record = await requireRecord(source, recordRoot)
    const author = await devAuthor(config, workspace)
    await answerQuestion(source, record, { questionsFile, questionId, answer, author }, config.format)
    await resolveDelegations(source, record, { questionsFile, questionId }, author)
    return loadDev(orca, recordRoot)
  })

  orca.panels.handle('dev.delegate', async ({ recordRoot, questionsFile, questionId, assignedTo, note }) => {
    const config = await readConfig(orca)
    const workspace = await requireWorkspace(orca)
    const source = localSource(workspace)
    const record = await requireRecord(source, recordRoot)
    const snapshot = await loadRecordSnapshot(source, record, config.format)
    const file = snapshot.questionFiles.find((candidate) => candidate.path === questionsFile)
    const question = file?.questions.find((candidate) => candidate.id === questionId)
    if (!file || !question) {
      throw new UserFacingError(`Pergunta ${questionId} não encontrada em ${questionsFile}.`)
    }
    const requestedBy = await devAuthor(config, workspace)
    const delegation = await delegateQuestion(source, record, {
      questionsFile,
      questionId,
      questionTitle: question.title,
      phase: file.phase,
      stage: file.stage,
      requestedBy,
      assignedTo: assignedTo.trim() || config.defaultPo || 'PO',
      ...(note.trim() ? { note: note.trim() } : {})
    })
    const git = await commitAndPush(
      workspace.path,
      [`${record.root}/${questionsFile}`, `${record.root}/.stk/delegations.json`],
      `aidlc: ${questionId} enviada a ${delegation.assignedTo} por ${requestedBy}`,
      config.pushDelegations
    )
    return { result: await loadDev(orca, recordRoot), git }
  })

  orca.panels.handle('dev.notifyAgent', async ({ recordRoot, questionsFile }) => {
    const { agents } = await orca.host.call('agents.list', {})
    const ready = agents.filter((agent) => agent.terminalId)
    const agent = ready.find((candidate) => candidate.state !== 'working') ?? ready[0]
    if (!agent?.terminalId) {
      throw new UserFacingError('Nenhum agente aberto nesta workspace.')
    }
    const text = `Atualizei as respostas em ${recordRoot}/${questionsFile}. Releia esse arquivo de perguntas e continue o workflow.`
    const { accepted } = await orca.host.call('terminal.sendText', { terminalId: agent.terminalId, text, enter: true })
    return { message: accepted ? `Aviso enviado para ${agent.title ?? agent.agent ?? 'o agente'}.` : 'O terminal não aceitou o aviso.' }
  })

  orca.panels.handle('dev.openFile', async ({ recordRoot, path }) => {
    const workspace = await requireWorkspace(orca)
    await orca.host.call('editor.open', { workspaceId: workspace.workspaceId, path: `${recordRoot}/${path}` })
    return { opened: true }
  })

  orca.panels.handle('dev.pull', async ({ recordRoot }) => {
    const workspace = await requireWorkspace(orca)
    const message = await pullFastForward(workspace.path)
    return { result: await loadDev(orca, recordRoot), message }
  })

  orca.panels.handle('inbox.load', async ({ refresh }) => {
    if (!refresh) {
      const last = (await orca.storage.get(LAST_INBOX)) as InboxResult | null
      const config = await readConfig(orca)
      if (last && last.demo === config.demo) {
        return last
      }
    }
    return refreshInbox(orca, false)
  })

  orca.panels.handle('inbox.answer', async ({ itemKey, answer }) => {
    const config = await readConfig(orca)
    const last = (await orca.storage.get(LAST_INBOX)) as InboxResult | null
    const item = last?.items.find((candidate) => candidate.key === itemKey)
    if (!item) {
      throw new UserFacingError('Essa pergunta não está mais na Caixa de Entrada. Atualize a lista.')
    }
    const source = (await projectSources(orca, config)).find((candidate) => candidate.label === item.projectLabel)
    if (!source) {
      throw new UserFacingError(`Projeto não configurado: ${item.projectLabel}`)
    }
    await answerInboxItem(source, item, answer, config.userName || 'PO', config.format)
    return refreshInbox(orca, false)
  })

  orca.panels.handle('config.status', () => configStatus(orca))

  orca.panels.handle('config.setSecret', async ({ key, value }) => {
    if (value.trim()) {
      await orca.secrets.set(key, value.trim())
    } else {
      await orca.secrets.delete(key)
    }
    return configStatus(orca)
  })

  orca.panels.handle('stories.sources', async () => {
    const config = await readConfig(orca)
    const sources: StoriesSource[] = []
    let notice: string | null = null
    const workspace = await focusedWorkspace(orca)
    if (!('notice' in workspace)) {
      const source = localSource(workspace)
      for (const record of await discoverRecords(source)) {
        const snapshot = await loadRecordSnapshot(source, record, config.format)
        if (snapshot.storiesFiles.length > 0) {
          sources.push({ id: `local|${workspace.name}|${record.root}`, label: `${workspace.name} · ${record.label}`, storiesFiles: snapshot.storiesFiles })
        }
      }
    }
    try {
      for (const source of await projectSources(orca, config)) {
        for (const record of await discoverRecords(source)) {
          const snapshot = await loadRecordSnapshot(source, record, config.format)
          if (snapshot.storiesFiles.length > 0) {
            sources.push({ id: `gh|${source.label}|${record.root}`, label: `${source.label} · ${record.label}`, storiesFiles: snapshot.storiesFiles })
          }
        }
      }
    } catch (error) {
      notice = error instanceof Error ? error.message : String(error)
    }
    if (sources.length === 0 && !notice) {
      notice = 'Nenhuma história gerada ainda (inception/user-stories/stories.md).'
    }
    return { sources, notice }
  })

  orca.panels.handle('stories.load', ({ sourceId, storiesFile }) => loadStoriesView(orca, sourceId, storiesFile))

  orca.panels.handle('stories.launch', async ({ sourceId, storiesFile, stories, newEpic }) => {
    const config = await readConfig(orca)
    const { source, record, author } = await storiesSourceById(orca, sourceId)
    const { client } = await jiraClient(orca, config)
    const result = await launchStories(source, record, client, { storiesFile, stories, newEpic, author })
    return { result, reloaded: await loadStoriesView(orca, sourceId, storiesFile) }
  })

  orca.commands.register('inbox.refresh', async () => {
    const result = await refreshInbox(orca, false)
    return result.configured
      ? `${result.items.length} pergunta(s) aguardando o PO.`
      : 'Configure os projetos do PO nas configurações do plugin STK AIDLC.'
  })

  orca.settings.onDidChange(() => {
    schedulePoll(orca)
  })
  void refreshInbox(orca, false).catch((error) => orca.log(`inbox refresh failed: ${String(error)}`))
  schedulePoll(orca)
}

export function deactivate(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}
