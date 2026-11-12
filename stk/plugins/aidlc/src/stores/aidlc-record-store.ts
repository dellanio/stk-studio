// QuestionStore and DelegationStore over any RecordFileSource (local checkout or GitHub), plus the
// record snapshot the panels draw.
import { randomUUID } from 'node:crypto'
import {
  parseQuestions,
  writeAnswer,
  type AidlcAnswer,
  type AidlcQuestionsDocument,
  type AidlcQuestionsFormatId
} from '../domain/aidlc-questions'
import {
  classifyRecordFile,
  DELEGATIONS_FILE,
  findRecords,
  RECORD_SCAN_ROOTS,
  stageOfRecordFile,
  type AidlcRecordRef
} from '../domain/aidlc-record'
import { parseState, type AidlcState } from '../domain/aidlc-state'
import {
  addDelegation,
  markAnswered,
  parseLedger,
  serializeLedger,
  type Delegation,
  type DelegationLedger,
  type NewDelegation
} from '../domain/delegations'
import type { RecordFileSource } from '../sources/record-file-source'

export type QuestionFileView = AidlcQuestionsDocument & {
  /** Record-relative. */
  path: string
  phase: string | null
  stage: string | null
}

export type RecordFileError = { path: string; message: string }

export type RecordSnapshot = {
  record: AidlcRecordRef
  state: AidlcState | null
  questionFiles: QuestionFileView[]
  artifacts: { path: string; phase: string | null; stage: string | null }[]
  storiesFiles: string[]
  delegations: Delegation[]
  errors: RecordFileError[]
}

const recordPath = (record: AidlcRecordRef, relative: string): string =>
  `${record.root}/${relative}`

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function discoverRecords(source: RecordFileSource): Promise<AidlcRecordRef[]> {
  const files: string[] = []
  for (const root of RECORD_SCAN_ROOTS) {
    files.push(...(await source.listFiles(root)))
  }
  return findRecords(files)
}

export async function loadRecordSnapshot(
  source: RecordFileSource,
  record: AidlcRecordRef,
  format?: AidlcQuestionsFormatId
): Promise<RecordSnapshot> {
  const files = (await source.listFiles(record.root)).map((path) =>
    path.slice(record.root.length + 1)
  )
  const snapshot: RecordSnapshot = {
    record,
    state: null,
    questionFiles: [],
    artifacts: [],
    storiesFiles: [],
    delegations: [],
    errors: []
  }
  const reads = files.map(async (relative) => {
    const kind = classifyRecordFile(relative)
    const where = stageOfRecordFile(relative)
    try {
      if (kind === 'state') {
        const file = await source.readFile(recordPath(record, relative))
        snapshot.state = file ? parseState(file.content) : null
      } else if (kind === 'questions') {
        const file = await source.readFile(recordPath(record, relative))
        if (file) {
          snapshot.questionFiles.push({
            ...parseQuestions(file.content, format),
            path: relative,
            ...where
          })
        }
      } else if (kind === 'stories') {
        snapshot.storiesFiles.push(relative)
        snapshot.artifacts.push({ path: relative, ...where })
      } else if (kind === 'artifact') {
        snapshot.artifacts.push({ path: relative, ...where })
      } else if (relative === DELEGATIONS_FILE) {
        snapshot.delegations = (await readLedger(source, record)).ledger.delegations
      }
    } catch (error) {
      snapshot.errors.push({ path: relative, message: message(error) })
    }
  })
  await Promise.all(reads)
  snapshot.questionFiles.sort((a, b) => a.path.localeCompare(b.path))
  snapshot.artifacts.sort((a, b) => a.path.localeCompare(b.path))
  return snapshot
}

/** QuestionStore: write one answer, preserving the rest of the file. */
export async function answerQuestion(
  source: RecordFileSource,
  record: AidlcRecordRef,
  input: { questionsFile: string; questionId: string; answer: AidlcAnswer; author: string },
  format?: AidlcQuestionsFormatId
): Promise<QuestionFileView> {
  const path = recordPath(record, input.questionsFile)
  const file = await source.readFile(path)
  if (!file) {
    throw new Error(`Arquivo de perguntas não encontrado: ${path}`)
  }
  const updated = writeAnswer(file.content, input.questionId, input.answer, format)
  const where = stageOfRecordFile(input.questionsFile)
  await source.writeFile(path, updated, {
    message: `aidlc: resposta para ${input.questionId} (${where.stage ?? input.questionsFile}) por ${input.author}`,
    expectedVersion: file.version
  })
  return { ...parseQuestions(updated, format), path: input.questionsFile, ...where }
}

async function readLedger(
  source: RecordFileSource,
  record: AidlcRecordRef
): Promise<{ ledger: DelegationLedger; version: string | null }> {
  const file = await source.readFile(recordPath(record, DELEGATIONS_FILE))
  return { ledger: parseLedger(file?.content ?? null), version: file?.version ?? null }
}

async function updateLedger(
  source: RecordFileSource,
  record: AidlcRecordRef,
  commitMessage: string,
  change: (ledger: DelegationLedger) => DelegationLedger
): Promise<DelegationLedger> {
  const { ledger, version } = await readLedger(source, record)
  const next = change(ledger)
  await source.writeFile(recordPath(record, DELEGATIONS_FILE), serializeLedger(next), {
    message: commitMessage,
    expectedVersion: version
  })
  return next
}

/** DelegationStore: record "Enviar ao PO". */
export async function delegateQuestion(
  source: RecordFileSource,
  record: AidlcRecordRef,
  input: NewDelegation,
  now = new Date()
): Promise<Delegation> {
  let created: Delegation | null = null
  await updateLedger(
    source,
    record,
    `aidlc: ${input.questionId} enviada a ${input.assignedTo}`,
    (ledger) => {
      const result = addDelegation(ledger, input, now, randomUUID)
      created = result.delegation
      return result.ledger
    }
  )
  return created as unknown as Delegation
}

/** DelegationStore: close what the answer resolved. No write when nothing was pending. */
export async function resolveDelegations(
  source: RecordFileSource,
  record: AidlcRecordRef,
  question: { questionsFile: string; questionId: string },
  answeredBy: string,
  now = new Date()
): Promise<boolean> {
  const { ledger } = await readLedger(source, record)
  const pending = ledger.delegations.some(
    (item) =>
      item.status === 'pending' &&
      item.questionsFile === question.questionsFile &&
      item.questionId === question.questionId
  )
  if (!pending) {
    return false
  }
  await updateLedger(
    source,
    record,
    `aidlc: delegação de ${question.questionId} respondida por ${answeredBy}`,
    (current) => markAnswered(current, question, answeredBy, now)
  )
  return true
}
