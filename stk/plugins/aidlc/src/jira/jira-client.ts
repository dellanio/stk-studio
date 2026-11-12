// JiraClient: what "Lançar no Jira" needs, with a REST implementation (Cloud v3 / Data Center v2)
// and a fake. Orca's native Jira integration (src/main/jira) is not reachable from plugins.
import type { HttpFetch } from '../sources/github-file-source'

export type JiraDeployment = 'cloud' | 'datacenter'

export type JiraConfig = {
  baseUrl: string
  deployment: JiraDeployment
  projectKey: string
  epicIssueType: string
  storyIssueType: string
  /** Cloud: account e-mail for Basic auth. Data Center: empty uses the token as a PAT (Bearer). */
  email: string
  token: string
  /** Custom field for acceptance criteria; empty appends them to the description. */
  acceptanceCriteriaField: string
  /** Data Center "Epic Link" field; Cloud uses `parent`. */
  epicLinkField: string
  /** Data Center "Epic Name" field, required there to create an epic. */
  epicNameField: string
  labels: string[]
}

export type JiraStoryInput = {
  summary: string
  description: string
  acceptanceCriteria: string[]
  epicKey: string | null
}

export type CreatedIssue = { key: string; url: string }

export type JiraClient = {
  createEpic(input: { summary: string; description: string }): Promise<CreatedIssue>
  createStory(input: JiraStoryInput): Promise<CreatedIssue>
}

export class JiraApiError extends Error {
  readonly code = 'jira_error'
}

type AdfNode = { type: string; content?: AdfNode[]; text?: string }

function adfDocument(description: string, bullets: string[]): AdfNode {
  const content: AdfNode[] = description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ type: 'paragraph', content: [{ type: 'text', text: paragraph }] }))
  if (bullets.length > 0) {
    content.push({
      type: 'bulletList',
      content: bullets.map((item) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }]
      }))
    })
  }
  return { type: 'doc', version: 1, content } as AdfNode
}

const wikiList = (items: string[]): string => items.map((item) => `* ${item}`).join('\n')

/** The `fields` object of a create-issue request for this deployment. */
export function buildIssueFields(
  config: JiraConfig,
  kind: 'epic' | 'story',
  input: JiraStoryInput
): Record<string, unknown> {
  const cloud = config.deployment === 'cloud'
  const criteria = input.acceptanceCriteria.filter((item) => item.trim() !== '')
  const inField =
    kind === 'story' && config.acceptanceCriteriaField.trim() !== '' && criteria.length > 0
  const descriptionBullets = kind === 'story' && !inField ? criteria : []
  const heading = descriptionBullets.length > 0 ? '\n\nCritérios de aceite:' : ''
  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    issuetype: { name: kind === 'epic' ? config.epicIssueType : config.storyIssueType },
    summary: input.summary.slice(0, 254),
    description: cloud
      ? adfDocument(`${input.description}${heading}`, descriptionBullets)
      : `${input.description}${heading}${descriptionBullets.length ? `\n${wikiList(descriptionBullets)}` : ''}`
  }
  if (config.labels.length > 0) {
    fields.labels = config.labels
  }
  if (inField) {
    fields[config.acceptanceCriteriaField] = cloud ? adfDocument('', criteria) : wikiList(criteria)
  }
  if (kind === 'epic' && !cloud && config.epicNameField.trim()) {
    fields[config.epicNameField] = input.summary.slice(0, 254)
  }
  if (kind === 'story' && input.epicKey) {
    if (cloud) {
      fields.parent = { key: input.epicKey }
    } else if (config.epicLinkField.trim()) {
      fields[config.epicLinkField] = input.epicKey
    }
  }
  return fields
}

function authorization(config: JiraConfig): string {
  if (config.email.trim()) {
    return `Basic ${Buffer.from(`${config.email}:${config.token}`, 'utf8').toString('base64')}`
  }
  return `Bearer ${config.token}`
}

async function errorText(response: { text(): Promise<string> }): Promise<string> {
  const body = await response.text()
  try {
    const parsed = JSON.parse(body) as { errorMessages?: string[]; errors?: Record<string, string> }
    const parts = [
      ...(parsed.errorMessages ?? []),
      ...Object.entries(parsed.errors ?? {}).map(([key, value]) => `${key}: ${value}`)
    ]
    return parts.join('; ') || body.slice(0, 300)
  } catch {
    return body.slice(0, 300)
  }
}

export function createRestJiraClient(config: JiraConfig, fetchImpl?: HttpFetch): JiraClient {
  const http: HttpFetch = fetchImpl ?? (globalThis.fetch as unknown as HttpFetch)
  const base = config.baseUrl.replace(/\/+$/, '')
  const api = `${base}/rest/api/${config.deployment === 'cloud' ? '3' : '2'}/issue`

  async function create(kind: 'epic' | 'story', input: JiraStoryInput): Promise<CreatedIssue> {
    const response = await http(api, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization(config)
      },
      body: JSON.stringify({ fields: buildIssueFields(config, kind, input) })
    })
    if (response.status === 401 || response.status === 403) {
      throw new JiraApiError(
        'Jira recusou as credenciais. Confira o token e o e-mail nas configurações.'
      )
    }
    if (!response.ok) {
      throw new JiraApiError(`Jira recusou (${response.status}): ${await errorText(response)}`)
    }
    const data = (await response.json()) as { key: string }
    return { key: data.key, url: `${base}/browse/${data.key}` }
  }

  return {
    createEpic: (input) => create('epic', { ...input, acceptanceCriteria: [], epicKey: null }),
    createStory: (input) => create('story', input)
  }
}

export type FakeJiraClient = JiraClient & {
  issues: ({ key: string; kind: 'epic' | 'story' } & JiraStoryInput)[]
}

/** Demo mode and tests: keys `<project>-<n>`, nothing leaves the machine. */
export function createFakeJiraClient(projectKey = 'DEMO', firstNumber = 1): FakeJiraClient {
  let next = firstNumber
  const issues: FakeJiraClient['issues'] = []
  const create = (kind: 'epic' | 'story', input: JiraStoryInput): CreatedIssue => {
    const key = `${projectKey}-${next++}`
    issues.push({ key, kind, ...input })
    return { key, url: `https://jira.example.invalid/browse/${key}` }
  }
  return {
    issues,
    createEpic: async (input) =>
      create('epic', { ...input, acceptanceCriteria: [], epicKey: null }),
    createStory: async (input) => create('story', input)
  }
}
