// A repository read and written through the GitHub REST API (contents + trees), so the PO never
// clones. Each write is one commit authored by the token's owner.
import {
  SourceConflictError,
  type RecordFileSource,
  type VersionedFile
} from './record-file-source'

export type GitHubProject = { owner: string; repo: string; branch: string }

export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>

export type GitHubSourceOptions = {
  project: GitHubProject
  token: string
  apiUrl?: string
  fetch?: HttpFetch
}

export class GitHubApiError extends Error {
  readonly code = 'github_error'
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/** `owner/repo@branch` (branch defaults to `main`); null when the line is not one. */
export function parseProjectLine(line: string): GitHubProject | null {
  const match = /^\s*([\w.-]+)\/([\w.-]+)(?:@([^\s#]+))?\s*$/.exec(line.replace(/#.*$/, ''))
  return match ? { owner: match[1], repo: match[2], branch: match[3] ?? 'main' } : null
}

export function projectLabel(project: GitHubProject): string {
  return `${project.owner}/${project.repo}@${project.branch}`
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/')

function decodeBase64(value: string): string {
  return Buffer.from(value.replace(/\s/g, ''), 'base64').toString('utf8')
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function describe(status: number, project: GitHubProject): string {
  if (status === 401) {
    return 'Token do GitHub inválido ou expirado.'
  }
  if (status === 403) {
    return `Sem permissão em ${projectLabel(project)} ou limite de requisições do GitHub atingido.`
  }
  if (status === 404) {
    return `Repositório ou branch não encontrado: ${projectLabel(project)}.`
  }
  return `GitHub respondeu ${status} para ${projectLabel(project)}.`
}

export function createGitHubFileSource(options: GitHubSourceOptions): RecordFileSource {
  const { project, token } = options
  const apiUrl = (options.apiUrl ?? 'https://api.github.com').replace(/\/+$/, '')
  const http: HttpFetch = options.fetch ?? (globalThis.fetch as unknown as HttpFetch)
  const repoUrl = `${apiUrl}/repos/${encodeURIComponent(project.owner)}/${encodeURIComponent(project.repo)}`
  let tree: Promise<string[] | null> | null = null

  async function call(method: string, url: string, body?: unknown) {
    const response = await http(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'stk-studio-aidlc',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return response
  }

  async function loadTree(): Promise<string[] | null> {
    const response = await call(
      'GET',
      `${repoUrl}/git/trees/${encodeURIComponent(project.branch)}?recursive=1`
    )
    if (!response.ok) {
      throw new GitHubApiError(describe(response.status, project), response.status)
    }
    const data = (await response.json()) as {
      truncated?: boolean
      tree?: { path: string; type: string }[]
    }
    if (data.truncated) {
      return null
    }
    return (data.tree ?? []).filter((entry) => entry.type === 'blob').map((entry) => entry.path)
  }

  async function walkContents(dir: string, into: string[]): Promise<void> {
    const response = await call(
      'GET',
      `${repoUrl}/contents/${encodePath(dir)}?ref=${encodeURIComponent(project.branch)}`
    )
    if (response.status === 404) {
      return
    }
    if (!response.ok) {
      throw new GitHubApiError(describe(response.status, project), response.status)
    }
    const entries = (await response.json()) as { path: string; type: string }[]
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry.type === 'dir') {
        await walkContents(entry.path, into)
      } else if (entry.type === 'file') {
        into.push(entry.path)
      }
    }
  }

  return {
    kind: 'github',
    label: projectLabel(project),
    async listFiles(root) {
      tree ??= loadTree()
      const all = await tree
      if (all) {
        return all.filter((path) => path === root || path.startsWith(`${root}/`)).sort()
      }
      const files: string[] = []
      await walkContents(root, files)
      return files.sort()
    },
    async readFile(path): Promise<VersionedFile | null> {
      const response = await call(
        'GET',
        `${repoUrl}/contents/${encodePath(path)}?ref=${encodeURIComponent(project.branch)}`
      )
      if (response.status === 404) {
        return null
      }
      if (!response.ok) {
        throw new GitHubApiError(describe(response.status, project), response.status)
      }
      const data = (await response.json()) as { content?: string; sha: string }
      return { content: decodeBase64(data.content ?? ''), version: data.sha }
    },
    async writeFile(path, content, { message, expectedVersion }) {
      const response = await call('PUT', `${repoUrl}/contents/${encodePath(path)}`, {
        message,
        content: encodeBase64(content),
        branch: project.branch,
        ...(expectedVersion ? { sha: expectedVersion } : {})
      })
      if (response.status === 409 || response.status === 422) {
        throw new SourceConflictError(path)
      }
      if (!response.ok) {
        throw new GitHubApiError(describe(response.status, project), response.status)
      }
      tree = null
      const data = (await response.json()) as { content?: { sha?: string } }
      return { content, version: data.content?.sha ?? '' }
    }
  }
}
