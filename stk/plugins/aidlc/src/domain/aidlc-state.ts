// AidlcStateParser: phases and stages from `aidlc-state.md`, v1 (`### 🔵 INCEPTION PHASE`,
// `- [x] Requirements Analysis (COMPLETED)`) and v2 (`- [-] units-generation — EXECUTE`).
import { plainText, splitLines } from './markdown-lines'

export type AidlcPhaseId = 'initialization' | 'ideation' | 'inception' | 'construction' | 'operations'

export type AidlcStageStatus =
  | 'pending'
  | 'in-progress'
  | 'awaiting-approval'
  | 'revising'
  | 'done'
  | 'skipped'

export type AidlcStage = {
  /** As written, without the plan suffix: `Requirements Analysis` or `requirements-analysis`. */
  name: string
  status: AidlcStageStatus
  /** `EXECUTE` / `SKIP` / `PLACEHOLDER` when the plan says so. */
  plan: string | null
}

export type AidlcPhase = { id: AidlcPhaseId; stages: AidlcStage[] }

export type AidlcState = {
  phases: AidlcPhase[]
  currentStage: string | null
  projectType: string | null
}

const PHASE_HEADING = /^#{2,4}\s+(?:\S+\s+)?(INITIALIZATION|IDEATION|INCEPTION|CONSTRUCTION|OPERATIONS?)\s+PHASE\b/i
const STAGE = /^[-*]\s+\[(.)\]\s+(.+?)\s*$/
const FIELD = /^[-*]\s+\*\*(.+?)\*\*:\s*(.*)$/

const STATUS_BY_MARK: Record<string, AidlcStageStatus> = {
  ' ': 'pending',
  x: 'done',
  X: 'done',
  '-': 'in-progress',
  '?': 'awaiting-approval',
  R: 'revising',
  S: 'skipped'
}

function phaseId(word: string): AidlcPhaseId {
  const upper = word.toUpperCase()
  return upper.startsWith('OPERATION') ? 'operations' : (upper.toLowerCase() as AidlcPhaseId)
}

function parseStage(mark: string, rest: string): AidlcStage {
  let status = STATUS_BY_MARK[mark] ?? 'pending'
  let text = plainText(rest)
  let plan: string | null = null
  const v2 = /^(.+?)\s+[—–-]\s+([A-Z]+)\b.*$/.exec(text)
  const v1Plan = /^(.+?)\s+-\s+\[?(EXECUTE|SKIP|PLACEHOLDER)(?:\/SKIP)?\]?(?:\s*\(.*\))?\s*$/.exec(text)
  if (v1Plan) {
    text = v1Plan[1]
    plan = v1Plan[2]
  } else if (v2) {
    text = v2[1]
    plan = v2[2]
  }
  const note = /^(.+?)\s*\(([^)]*)\)\s*$/.exec(text)
  if (note) {
    text = note[1]
    const label = note[2].toUpperCase()
    if (status === 'done' && label.includes('IN PROGRESS')) {
      status = 'in-progress'
    } else if (label === 'SKIPPED') {
      status = 'skipped'
    }
  }
  if (status === 'pending' && plan === 'SKIP') {
    status = 'skipped'
  }
  return { name: text.trim(), status, plan }
}

export function parseState(source: string): AidlcState {
  const phases: AidlcPhase[] = []
  let current: AidlcPhase | null = null
  let currentStage: string | null = null
  let projectType: string | null = null
  let inStageProgress = false

  for (const { text } of splitLines(source)) {
    if (/^##\s+/.test(text) && !/^###/.test(text)) {
      inStageProgress = /^##\s+Stage Progress/i.test(text)
      current = null
    }
    const field = FIELD.exec(text)
    if (field) {
      const key = field[1].toLowerCase()
      if (key === 'current stage' && field[2].trim()) {
        currentStage = field[2].trim()
      } else if (key === 'project type' && field[2].trim()) {
        projectType = field[2].trim()
      }
      continue
    }
    const heading = PHASE_HEADING.exec(text)
    if (heading) {
      const id = phaseId(heading[1])
      current = phases.find((phase) => phase.id === id) ?? null
      if (!current) {
        current = { id, stages: [] }
        phases.push(current)
      }
      continue
    }
    const stage = STAGE.exec(text)
    if (stage && current && (inStageProgress || phases.length > 0)) {
      current.stages.push(parseStage(stage[1], stage[2]))
    }
  }
  return { phases, currentStage, projectType }
}

export type AidlcPhaseProgress = { done: number; total: number; percent: number }

/** Skipped stages count neither as done nor as remaining work. */
export function phaseProgress(phase: AidlcPhase): AidlcPhaseProgress {
  const counted = phase.stages.filter((stage) => stage.status !== 'skipped')
  const done = counted.filter((stage) => stage.status === 'done').length
  return {
    done,
    total: counted.length,
    percent: counted.length === 0 ? 100 : Math.round((100 * done) / counted.length)
  }
}
