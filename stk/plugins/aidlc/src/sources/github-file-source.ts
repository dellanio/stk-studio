// A repository read and written through the GitHub REST API (contents + trees), so the PO never
// clones. Each write is one commit authored by the token's owner.
import { isRecord, stringOf } from '../domain/json-value'
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

/** `path` of each `{ path, type }` entry of that type, from a trees or contents API answer. */
function pathsOfType(entries: unknown, type: string): string[] {
  if (!Array.isArray(entries)) {
    return []
  }
  return entries.flatMap((entry) =>
    isRecord(entry) && entry.type === type && typeof entry.path === 'string' ? [entry.path] : []
  )
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
  const http: HttpFetch = options.fetch ?? globalThis.fetch
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
    const data: unknown = await response.json()
    if (!isRecord(data) || data.truncated === true) {
      return null
    }
    return pathsOfType(data.tree, 'blob')
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
    const entries: unknown = await response.json()
    for (const subdir of pathsOfType(entries, 'dir')) {
      await walkContents(subdir, into)
    }
    into.push(...pathsOfType(entries, 'file'))
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
      const data: unknown = await response.json()
      if (!isRecord(data)) {
        throw new GitHubApiError(describe(response.status, project), response.status)
      }
      return {
        content: decodeBase64(stringOf(data.content) ?? ''),
        version: stringOf(data.sha) ?? ''
      }
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
      const data: unknown = await response.json()
      const written =
        isRecord(data) && isRecord(data.content) ? stringOf(data.content.sha) : undefined
      return { content, version: written ?? '' }
    }
  }
}
