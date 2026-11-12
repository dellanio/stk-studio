// What every handler needs: the focused local workspace, the PO's project sources (GitHub or
// demo) and the Jira client, all built from the plugin's settings and secrets.
import { fileURLToPath } from 'node:url'
import type { OrcaWorkerApi } from 'orca/worker'
import type { AidlcRecordRef } from '../domain/aidlc-record'
import { createFakeJiraClient, createRestJiraClient, type JiraClient } from '../jira/jira-client'
import { createGitHubFileSource } from '../sources/github-file-source'
import { createLocalFileSource } from '../sources/local-file-source'
import { createMemoryFileSource } from '../sources/memory-file-source'
import type { RecordFileSource } from '../sources/record-file-source'
import { discoverRecords } from '../stores/aidlc-record-store'
import { gitUserName } from './git-sync'
import { readSecret, type PluginConfig } from './plugin-config'

const PLUGIN_ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const DEMO_JIRA_TARGET = 'Jira simulado (modo demonstração)'

export type LocalWorkspace = { name: string; branch: string; path: string; workspaceId: string }

export class UserFacingError extends Error {
  readonly code = 'action_failed'
}

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

export async function projectSources(
  orca: OrcaWorkerApi,
  config: PluginConfig
): Promise<RecordFileSource[]> {
  if (config.demo) {
    return loadDemoSources()
  }
  if (config.projects.length === 0) {
    return []
  }
  const token = await readSecret(orca, 'githubToken')
  if (!token) {
    throw new UserFacingError('Informe o token do GitHub na aba Ajustes da Caixa de Entrada.')
  }
  return config.projects.map((project) =>
    createGitHubFileSource({ project, token, apiUrl: config.githubApiUrl })
  )
}

export async function jiraClient(orca: OrcaWorkerApi, config: PluginConfig): Promise<JiraClient> {
  if (config.demo) {
    demoJira ??= createFakeJiraClient('DEMO')
    return demoJira
  }
  const token = await readSecret(orca, 'jiraToken')
  if (!config.jira.baseUrl || !config.jira.projectKey || !token) {
    throw new UserFacingError('Configure URL, projeto e token do Jira antes de lançar.')
  }
  return createRestJiraClient({ ...config.jira, token })
}

export function jiraTarget(config: PluginConfig): string {
  if (config.demo) {
    return DEMO_JIRA_TARGET
  }
  return config.jira.baseUrl
    ? `${config.jira.baseUrl} · ${config.jira.projectKey || 'projeto não configurado'}`
    : 'Jira não configurado'
}

export async function focusedWorkspace(
  orca: OrcaWorkerApi
): Promise<LocalWorkspace | { notice: string }> {
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

export async function requireWorkspace(orca: OrcaWorkerApi): Promise<LocalWorkspace> {
  const workspace = await focusedWorkspace(orca)
  if ('notice' in workspace) {
    throw new UserFacingError(workspace.notice)
  }
  return workspace
}

export function localSource(workspace: LocalWorkspace): RecordFileSource {
  return createLocalFileSource(workspace.path, workspace.name)
}

export async function devAuthor(config: PluginConfig, workspace: LocalWorkspace): Promise<string> {
  return config.userName || (await gitUserName(workspace.path)) || 'Dev'
}

export async function requireRecord(
  source: RecordFileSource,
  root: string
): Promise<AidlcRecordRef> {
  const record = (await discoverRecords(source)).find((candidate) => candidate.root === root)
  if (!record) {
    throw new UserFacingError(`Registro do AIDLC não encontrado: ${root}`)
  }
  return record
}
