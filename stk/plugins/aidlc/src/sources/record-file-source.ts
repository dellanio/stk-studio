// Where record files come from: the developer's checkout (local) or a repository read through the
// GitHub API (PO mode, no clone). Paths are repository-relative and `/`-separated.

export type VersionedFile = { content: string; version: string }

export type WriteOptions = {
  /** Commit message for sources that commit. */
  message: string
  /** The version read before the change; a different current version is a conflict. */
  expectedVersion: string | null
}

export type RecordFileSource = {
  readonly kind: 'local' | 'github'
  /** Shown to people: the workspace name or `owner/repo@branch`. */
  readonly label: string
  /** Every file under `root`, recursively. */
  listFiles(root: string): Promise<string[]>
  readFile(path: string): Promise<VersionedFile | null>
  writeFile(path: string, content: string, options: WriteOptions): Promise<VersionedFile>
}

export class SourceConflictError extends Error {
  readonly code = 'conflict'
  constructor(path: string) {
    super(`${path} mudou desde a última leitura. Atualize e tente de novo.`)
  }
}

/** Cheap content fingerprint for sources without a native version (FNV-1a, 32 bit). */
export function contentVersion(content: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < content.length; index++) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${content.length.toString(36)}-${hash.toString(36)}`
}
