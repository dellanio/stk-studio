// The few Node built-ins the worker and tests use; plugin typings ship no @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string
}

declare module 'node:fs/promises' {
  export type DirentLike = { name: string; isDirectory(): boolean; isFile(): boolean }
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>
  export function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>
  export function readdir(path: string, options: { withFileTypes: true }): Promise<DirentLike[]>
  export function mkdtemp(prefix: string): Promise<string>
  export function rm(path: string, options: { recursive: true; force: true }): Promise<void>
}

declare module 'node:path' {
  export function join(...parts: string[]): string
  export function dirname(path: string): string
  export function resolve(...parts: string[]): string
  export function relative(from: string, to: string): string
  export const sep: string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}

declare module 'node:os' {
  export function tmpdir(): string
}

declare module 'node:crypto' {
  export function randomUUID(): string
}

declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: { cwd: string; timeout?: number; windowsHide?: boolean },
    callback: (error: (Error & { code?: unknown }) | null, stdout: string, stderr: string) => void
  ): unknown
}

declare module 'node:http' {
  export type IncomingMessage = {
    method?: string
    url?: string
    headers: Record<string, string | string[] | undefined>
    on(event: 'data', listener: (chunk: { toString(encoding: 'utf8'): string }) => void): void
    on(event: 'end', listener: () => void): void
  }
  export type ServerResponse = {
    writeHead(status: number, headers?: Record<string, string>): void
    end(body?: string): void
  }
  export type Server = {
    listen(port: number, host: string, callback: () => void): void
    address(): { port: number } | string | null
    close(callback?: () => void): void
  }
  export function createServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Server
}

declare const process: { env: Record<string, string | undefined>; platform: string }
declare const Buffer: {
  from(value: string, encoding?: 'utf8' | 'base64'): { toString(encoding: 'utf8' | 'base64'): string }
}
