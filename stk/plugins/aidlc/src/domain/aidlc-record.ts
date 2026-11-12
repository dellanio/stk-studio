// Where an AI-DLC record lives and what is in it. v1 (and v2 flat-legacy) keep one record in
// `aidlc-docs/`; v2 keeps one per intent in `aidlc/spaces/<space>/intents/<id>/`.

export type AidlcRecordLayout = 'aidlc-docs' | 'intent'

export type AidlcRecordRef = {
  /** Repository-relative, `/`-separated, no trailing slash: `aidlc-docs`. */
  root: string
  layout: AidlcRecordLayout
  /** Shown to people: `aidlc-docs` or the intent folder name. */
  label: string
}

export type AidlcRecordFileKind = 'state' | 'questions' | 'stories' | 'artifact' | 'internal'

const STATE_FILE = 'aidlc-state.md'
export const DELEGATIONS_FILE = '.stk/delegations.json'

export function findRecords(paths: readonly string[]): AidlcRecordRef[] {
  const records: AidlcRecordRef[] = []
  for (const path of paths) {
    if (path === `aidlc-docs/${STATE_FILE}`) {
      records.push({ root: 'aidlc-docs', layout: 'aidlc-docs', label: 'aidlc-docs' })
      continue
    }
    const intent = /^(aidlc\/spaces\/[^/]+\/intents\/([^/]+))\/aidlc-state\.md$/.exec(path)
    if (intent) {
      records.push({ root: intent[1], layout: 'intent', label: intent[2] })
    }
  }
  return records.sort((a, b) => b.root.localeCompare(a.root))
}

/** The record folders a scan needs to look at, for sources that cannot list everything cheaply. */
export const RECORD_SCAN_ROOTS = ['aidlc-docs', 'aidlc/spaces'] as const

export function classifyRecordFile(relativePath: string): AidlcRecordFileKind {
  const name = relativePath.split('/').pop() ?? relativePath
  if (relativePath.startsWith('.stk/') || relativePath.startsWith('.aidlc-engine/') || name.startsWith('.')) {
    return 'internal'
  }
  if (relativePath === STATE_FILE) {
    return 'state'
  }
  if (name.endsWith('-questions.md')) {
    return 'questions'
  }
  if (name === 'stories.md' && relativePath.includes('user-stories')) {
    return 'stories'
  }
  if (name === 'audit.md' || !name.endsWith('.md')) {
    return 'internal'
  }
  return 'artifact'
}

/** `inception/requirements-analysis/x-questions.md` → phase `inception`, stage `requirements-analysis`. */
export function stageOfRecordFile(relativePath: string): { phase: string | null; stage: string | null } {
  const parts = relativePath.split('/')
  if (parts.length < 2) {
    return { phase: null, stage: null }
  }
  const phase = parts[0]
  if (phase === 'construction' && parts.length >= 4) {
    return { phase, stage: `${parts[1]} · ${parts[2]}` }
  }
  const stage = parts.length >= 3 ? parts[1] : parts[1].replace(/-questions\.md$|\.md$/, '')
  return { phase, stage }
}
