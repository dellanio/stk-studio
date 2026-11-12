// In-memory files: demo mode (seeded from the bundled fixtures) and tests.
import { contentVersion, SourceConflictError, type RecordFileSource } from './record-file-source'

export type MemoryFileSource = RecordFileSource & {
  files: Map<string, string>
  writes: { path: string; message: string }[]
}

export function createMemoryFileSource(
  label: string,
  initial: Record<string, string>,
  kind: RecordFileSource['kind'] = 'github'
): MemoryFileSource {
  const files = new Map(Object.entries(initial))
  const writes: { path: string; message: string }[] = []
  return {
    kind,
    label,
    files,
    writes,
    async listFiles(root) {
      return [...files.keys()].filter((path) => path === root || path.startsWith(`${root}/`)).sort()
    },
    async readFile(path) {
      const content = files.get(path)
      return content === undefined ? null : { content, version: contentVersion(content) }
    },
    async writeFile(path, content, { message, expectedVersion }) {
      const current = files.get(path)
      if ((current === undefined ? null : contentVersion(current)) !== expectedVersion) {
        throw new SourceConflictError(path)
      }
      files.set(path, content)
      writes.push({ path, message })
      return { content, version: contentVersion(content) }
    }
  }
}
