// Typed view of the plugin's settings and secrets (tokens live only in secrets:own).
import type { OrcaWorkerApi } from 'orca/worker'
import type { AidlcQuestionsFormatId } from '../domain/aidlc-questions'
import type { JiraConfig } from '../jira/jira-client'
import { parseProjectLine, type GitHubProject } from '../sources/github-file-source'

export type PluginConfig = {
  userName: string
  defaultPo: string
  pushDelegations: boolean
  format: AidlcQuestionsFormatId | undefined
  projects: GitHubProject[]
  invalidProjectLines: string[]
  githubApiUrl: string
  pollMinutes: number
  demo: boolean
  jira: Omit<JiraConfig, 'token'>
}

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback)

export async function readConfig(orca: OrcaWorkerApi): Promise<PluginConfig> {
  const settings = (await orca.settings.get()) as Record<string, unknown>
  const lines = text(settings.projects)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
  const projects: GitHubProject[] = []
  const invalidProjectLines: string[] = []
  for (const line of lines) {
    const project = parseProjectLine(line)
    if (project) {
      projects.push(project)
    } else {
      invalidProjectLines.push(line)
    }
  }
  const format = text(settings.aidlcFormat, 'auto')
  const poll = typeof settings.pollMinutes === 'number' ? settings.pollMinutes : 5
  return {
    userName: text(settings.userName),
    defaultPo: text(settings.defaultPo),
    pushDelegations: settings.pushDelegations !== false,
    format: format === 'aidlc-v1' || format === 'aidlc-v2' ? format : undefined,
    projects,
    invalidProjectLines,
    githubApiUrl: text(settings.githubApiUrl) || 'https://api.github.com',
    pollMinutes: Math.min(120, Math.max(1, Math.round(poll))),
    demo: settings.demoMode === true,
    jira: {
      baseUrl: text(settings.jiraBaseUrl),
      deployment: text(settings.jiraDeployment) === 'datacenter' ? 'datacenter' : 'cloud',
      projectKey: text(settings.jiraProjectKey),
      epicIssueType: text(settings.jiraEpicIssueType) || 'Epic',
      storyIssueType: text(settings.jiraStoryIssueType) || 'Story',
      email: text(settings.jiraEmail),
      acceptanceCriteriaField: text(settings.jiraAcceptanceCriteriaField),
      epicLinkField: text(settings.jiraEpicLinkField),
      epicNameField: text(settings.jiraEpicNameField),
      labels: text(settings.jiraLabels, 'aidlc')
        .split(/[,\s]+/)
        .filter(Boolean)
    }
  }
}

export async function readSecret(orca: OrcaWorkerApi, key: 'githubToken' | 'jiraToken'): Promise<string | null> {
  try {
    const value = await orca.secrets.get(key)
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

export async function secretsAvailable(orca: OrcaWorkerApi): Promise<boolean> {
  try {
    const { status } = await orca.host.call('secrets.protection', {})
    return status === 'os-keyring'
  } catch {
    return false
  }
}
