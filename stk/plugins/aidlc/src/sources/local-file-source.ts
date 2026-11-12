// The developer's checkout on this machine (P11: local only).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  contentVersion,
  SourceConflictError,
  type RecordFileSource,
  type VersionedFile
} from './record-file-source'

const SKIPPED = new Set(['node_modules', '.git'])

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT'
  )
}

export function createLocalFileSource(rootDir: string, label: string): RecordFileSource {
  const absolute = (path: string): string => join(rootDir, ...path.split('/'))

  async function walk(relativeDir: string, into: string[]): Promise<void> {
    let entries
    try {
      entries = await readdir(absolute(relativeDir), { withFileTypes: true })
    } catch (error) {
      if (isMissing(error)) {
        return
      }
      throw error
    }
    for (const entry of entries) {
      const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
      if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
        await walk(child, into)
      } else if (entry.isFile()) {
        into.push(child)
      }
    }
  }

  async function read(path: string): Promise<VersionedFile | null> {
    try {
      const content = await readFile(absolute(path), 'utf8')
      return { content, version: contentVersion(content) }
    } catch (error) {
      if (isMissing(error)) {
        return null
      }
      throw error
    }
  }

  return {
    kind: 'local',
    label,
    async listFiles(root) {
      const files: string[] = []
      await walk(root, files)
      return files.sort()
    },
    readFile: read,
    async writeFile(path, content, { expectedVersion }) {
      const current = await read(path)
      if ((current?.version ?? null) !== expectedVersion) {
        throw new SourceConflictError(path)
      }
      await mkdir(dirname(absolute(path)), { recursive: true })
      await writeFile(absolute(path), content, 'utf8')
      return { content, version: contentVersion(content) }
    }
  }
}
