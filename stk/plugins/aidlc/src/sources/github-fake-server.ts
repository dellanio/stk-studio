// A local stand-in for the three GitHub endpoints the source uses, for tests (no network).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

export type FakeGitHub = {
  url: string
  files: Map<string, { content: string; sha: string }>
  commits: { path: string; message: string; branch: string }[]
  close(): Promise<void>
}

const b64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64')
const fromB64 = (value: string): string => Buffer.from(value, 'base64').toString('utf8')

export async function startFakeGitHub(options: {
  owner: string
  repo: string
  branch: string
  token: string
  files: Record<string, string>
}): Promise<FakeGitHub> {
  let next = 1
  const sha = (): string => `sha${next++}`
  const files = new Map(Object.entries(options.files).map(([path, content]) => [path, { content, sha: sha() }]))
  const commits: FakeGitHub['commits'] = []
  const prefix = `/repos/${options.owner}/${options.repo}`

  const send = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const handle = (req: IncomingMessage, res: ServerResponse, body: string): void => {
    if (req.headers.authorization !== `Bearer ${options.token}`) {
      send(res, 401, { message: 'Bad credentials' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://fake')
    if (!url.pathname.startsWith(prefix)) {
      send(res, 404, { message: 'Not Found' })
      return
    }
    const rest = url.pathname.slice(prefix.length)
    if (req.method === 'GET' && rest === `/git/trees/${options.branch}`) {
      send(res, 200, { truncated: false, tree: [...files.keys()].map((path) => ({ path, type: 'blob' })) })
      return
    }
    if (!rest.startsWith('/contents/')) {
      send(res, 404, { message: 'Not Found' })
      return
    }
    const path = decodeURIComponent(rest.slice('/contents/'.length))
    const file = files.get(path)
    if (req.method === 'GET') {
      if (url.searchParams.get('ref') !== options.branch || !file) {
        send(res, 404, { message: 'Not Found' })
        return
      }
      send(res, 200, { type: 'file', path, sha: file.sha, encoding: 'base64', content: b64(file.content) })
      return
    }
    if (req.method === 'PUT') {
      const input = JSON.parse(body) as { message: string; content: string; sha?: string; branch: string }
      if (input.branch !== options.branch) {
        send(res, 404, { message: 'Branch not found' })
        return
      }
      if ((file?.sha ?? undefined) !== input.sha) {
        send(res, file ? 409 : 422, { message: 'sha mismatch' })
        return
      }
      const updated = { content: fromB64(input.content), sha: sha() }
      files.set(path, updated)
      commits.push({ path, message: input.message, branch: input.branch })
      send(res, file ? 200 : 201, { content: { path, sha: updated.sha } })
      return
    }
    send(res, 405, { message: 'Method not allowed' })
  }

  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString('utf8')
    })
    req.on('end', () => handle(req, res, body))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    files,
    commits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
