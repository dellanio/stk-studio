// Histórias → Jira in the worker: where stories are (local record or PO projects), read them,
// launch the selected ones.
import type { OrcaWorkerApi } from 'orca/worker'
import type { AidlcRecordRef } from '../domain/aidlc-record'
import type { StoriesLoadResult, StoriesSource } from '../protocol'
import type { RecordFileSource } from '../sources/record-file-source'
import { discoverRecords, loadRecordSnapshot } from '../stores/aidlc-record-store'
import { launchStories, readStories } from '../stores/stories-launch'
import { readConfig, type PluginConfig } from './plugin-config'
import {
  devAuthor,
  focusedWorkspace,
  jiraClient,
  jiraTarget,
  localSource,
  projectSources,
  requireRecord,
  requireWorkspace,
  UserFacingError
} from './worker-context'

type ResolvedSource = { source: RecordFileSource; record: AidlcRecordRef; author: string }

async function sourceById(orca: OrcaWorkerApi, sourceId: string): Promise<ResolvedSource> {
  const config = await readConfig(orca)
  const [kind, label, root] = sourceId.split('|')
  if (kind === 'local') {
    const workspace = await requireWorkspace(orca)
    const source = localSource(workspace)
    return {
      source,
      record: await requireRecord(source, root),
      author: await devAuthor(config, workspace)
    }
  }
  const source = (await projectSources(orca, config)).find((candidate) => candidate.label === label)
  if (!source) {
    throw new UserFacingError(`Projeto não configurado: ${label}`)
  }
  return { source, record: await requireRecord(source, root), author: config.userName || 'PO' }
}

async function loadView(
  orca: OrcaWorkerApi,
  sourceId: string,
  storiesFile: string
): Promise<StoriesLoadResult> {
  const { source, record } = await sourceById(orca, sourceId)
  const document = await readStories(source, record, storiesFile)
  return {
    sourceId,
    storiesFile,
    epicJiraKey: document.epicJiraKey,
    stories: document.stories,
    jiraTarget: jiraTarget(await readConfig(orca))
  }
}

async function storiesSourcesOf(
  source: RecordFileSource,
  idPrefix: string,
  label: string,
  config: PluginConfig
): Promise<StoriesSource[]> {
  const found: StoriesSource[] = []
  for (const record of await discoverRecords(source)) {
    const snapshot = await loadRecordSnapshot(source, record, config.format)
    if (snapshot.storiesFiles.length > 0) {
      found.push({
        id: `${idPrefix}|${record.root}`,
        label: `${label} · ${record.label}`,
        storiesFiles: snapshot.storiesFiles
      })
    }
  }
  return found
}

export function registerStoriesHandlers(orca: OrcaWorkerApi): void {
  orca.panels.handle('stories.sources', async () => {
    const config = await readConfig(orca)
    const sources: StoriesSource[] = []
    let notice: string | null = null
    const workspace = await focusedWorkspace(orca)
    if (!('notice' in workspace)) {
      sources.push(
        ...(await storiesSourcesOf(
          localSource(workspace),
          `local|${workspace.name}`,
          workspace.name,
          config
        ))
      )
    }
    try {
      for (const source of await projectSources(orca, config)) {
        sources.push(
          ...(await storiesSourcesOf(source, `gh|${source.label}`, source.label, config))
        )
      }
    } catch (error) {
      notice = error instanceof Error ? error.message : String(error)
    }
    if (sources.length === 0 && !notice) {
      notice = 'Nenhuma história gerada ainda (inception/user-stories/stories.md).'
    }
    return { sources, notice }
  })

  orca.panels.handle('stories.load', ({ sourceId, storiesFile }) =>
    loadView(orca, sourceId, storiesFile)
  )

  orca.panels.handle('stories.launch', async ({ sourceId, storiesFile, stories, newEpic }) => {
    const config = await readConfig(orca)
    const { source, record, author } = await sourceById(orca, sourceId)
    const client = await jiraClient(orca, config)
    const result = await launchStories(source, record, client, {
      storiesFile,
      stories,
      newEpic,
      author
    })
    return { result, reloaded: await loadView(orca, sourceId, storiesFile) }
  })
}
