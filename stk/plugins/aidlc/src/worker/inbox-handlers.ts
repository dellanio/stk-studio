// Caixa de Entrada do PO in the worker: refresh across projects, answer, tokens, plus the
// periodic check behind the status bar badge and the native notification.
import type { OrcaWorkerApi } from 'orca/worker'
import type { ConfigStatus, InboxResult } from '../protocol'
import { projectLabel } from '../sources/github-file-source'
import { answerInboxItem, collectInbox } from './inbox'
import { readConfig, readSecret, secretsAvailable, type PluginConfig } from './plugin-config'
import { projectSources, UserFacingError } from './worker-context'

const LAST_INBOX = 'inbox.last'
const SEEN = 'inbox.seen'

/** The last refresh, which only this worker writes (as JSON text). */
async function lastInbox(orca: OrcaWorkerApi): Promise<InboxResult | null> {
  const stored = await orca.storage.get(LAST_INBOX)
  if (typeof stored !== 'string') {
    return null
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: written only by refreshInbox from an InboxResult in this worker.
  return JSON.parse(stored) as InboxResult
}

let pollTimer: ReturnType<typeof setTimeout> | null = null

function emptyInbox(config: PluginConfig): InboxResult {
  return {
    configured: config.demo || config.projects.length > 0,
    demo: config.demo,
    checkedAt: null,
    items: [],
    projects: [],
    errors: config.invalidProjectLines.map(
      (line) => `Projeto inválido nas configurações: "${line}" (use owner/repo@branch).`
    )
  }
}

async function announceNew(orca: OrcaWorkerApi, result: InboxResult, notify: boolean) {
  const stored = await orca.storage.get(SEEN)
  const seen = new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === 'string') : [])
  const fresh = result.items.filter((item) => !seen.has(item.key))
  await orca.storage.set(
    SEEN,
    result.items.map((item) => item.key)
  )
  if (!notify || fresh.length === 0) {
    return
  }
  const first = fresh[0]
  await orca.host
    .call('notifications.show', {
      title:
        fresh.length === 1
          ? 'Nova pergunta para o PO'
          : `${fresh.length} novas perguntas para o PO`,
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
      text: `PO: ${pending}`,
      tone: pending > 0 ? 'accent' : 'neutral',
      tooltip:
        pending > 0 ? `${pending} pergunta(s) aguardando o PO` : 'Nenhuma pergunta aguardando o PO'
    })
    .catch(() => undefined)
}

export async function refreshInbox(orca: OrcaWorkerApi, notify: boolean): Promise<InboxResult> {
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
  await orca.storage.set(LAST_INBOX, JSON.stringify(result))
  await announceNew(orca, result, notify)
  await updateBadge(orca, result)
  orca.panels.post('inbox.changed', { pending: result.items.length })
  return result
}

export function schedulePoll(orca: OrcaWorkerApi): void {
  stopPolling()
  void readConfig(orca).then((config) => {
    pollTimer = setTimeout(async () => {
      await refreshInbox(orca, true).catch((error) =>
        orca.log(`inbox poll failed: ${String(error)}`)
      )
      schedulePoll(orca)
    }, config.pollMinutes * 60_000)
  })
}

export function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
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

export function registerInboxHandlers(orca: OrcaWorkerApi): void {
  orca.panels.handle('inbox.load', async ({ refresh }) => {
    if (!refresh) {
      const last = await lastInbox(orca)
      const config = await readConfig(orca)
      if (last && last.demo === config.demo) {
        return last
      }
    }
    return refreshInbox(orca, false)
  })

  orca.panels.handle('inbox.answer', async ({ itemKey, answer }) => {
    const config = await readConfig(orca)
    const last = await lastInbox(orca)
    const item = last?.items.find((candidate) => candidate.key === itemKey)
    if (!item) {
      throw new UserFacingError(
        'Essa pergunta não está mais na Caixa de Entrada. Atualize a lista.'
      )
    }
    const source = (await projectSources(orca, config)).find(
      (candidate) => candidate.label === item.projectLabel
    )
    if (!source) {
      throw new UserFacingError(`Projeto não configurado: ${item.projectLabel}`)
    }
    await answerInboxItem(source, item, answer, config.userName || 'PO', config.format)
    return refreshInbox(orca, false)
  })

  orca.panels.handle('config.status', () => configStatus(orca))

  orca.panels.handle('config.setSecret', async ({ key, value }) => {
    await (value.trim() ? orca.secrets.set(key, value.trim()) : orca.secrets.delete(key))
    return configStatus(orca)
  })

  orca.commands.register('inbox.refresh', async () => {
    const result = await refreshInbox(orca, false)
    return result.configured
      ? `${result.items.length} pergunta(s) aguardando o PO.`
      : 'Configure os projetos do PO nas configurações do plugin STK AIDLC.'
  })
}
