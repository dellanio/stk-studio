// Caixa de Entrada do PO: delegated questions still pending, across every configured project,
// read through the GitHub API (or the demo sources).
import type { AidlcAnswer, AidlcQuestionsFormatId } from '../domain/aidlc-questions'
import { phaseLabel, stageLabel } from '../domain/business-language'
import type { InboxItem, ProjectStatusView } from '../protocol'
import {
  answerQuestion,
  discoverRecords,
  loadRecordSnapshot,
  resolveDelegations
} from '../stores/aidlc-record-store'
import type { RecordFileSource } from '../sources/record-file-source'
import { phaseViews } from './record-views'

export type InboxCollection = {
  items: InboxItem[]
  projects: ProjectStatusView[]
  errors: string[]
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function collectInbox(
  sources: readonly RecordFileSource[],
  format?: AidlcQuestionsFormatId
): Promise<InboxCollection> {
  const collection: InboxCollection = { items: [], projects: [], errors: [] }
  await Promise.all(
    sources.map(async (source) => {
      const status: ProjectStatusView = { projectLabel: source.label, error: null, records: [] }
      collection.projects.push(status)
      try {
        for (const record of await discoverRecords(source)) {
          const snapshot = await loadRecordSnapshot(source, record, format)
          collection.errors.push(...snapshot.errors.map((error) => `${source.label}: ${error.path}: ${error.message}`))
          status.records.push({
            label: record.label,
            root: record.root,
            phases: phaseViews(snapshot.state),
            pendingQuestions: snapshot.questionFiles.reduce(
              (count, file) => count + file.questions.filter((question) => question.rawAnswer === null).length,
              0
            )
          })
          for (const delegation of snapshot.delegations) {
            if (delegation.status !== 'pending') {
              continue
            }
            const file = snapshot.questionFiles.find((candidate) => candidate.path === delegation.questionsFile)
            collection.items.push({
              key: `${source.label}|${record.root}|${delegation.id}`,
              projectLabel: source.label,
              recordRoot: record.root,
              recordLabel: record.label,
              delegation,
              phaseLabel: phaseLabel(delegation.phase ?? file?.phase ?? null),
              stageLabel: stageLabel(delegation.stage ?? file?.stage ?? null),
              question: file?.questions.find((question) => question.id === delegation.questionId) ?? null
            })
          }
        }
      } catch (error) {
        status.error = message(error)
        collection.errors.push(`${source.label}: ${message(error)}`)
      }
    })
  )
  collection.items.sort((a, b) => a.delegation.requestedAt.localeCompare(b.delegation.requestedAt))
  collection.projects.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
  return collection
}

export async function answerInboxItem(
  source: RecordFileSource,
  item: InboxItem,
  answer: AidlcAnswer,
  author: string,
  format?: AidlcQuestionsFormatId
): Promise<void> {
  const record = { root: item.recordRoot, layout: 'aidlc-docs' as const, label: item.recordLabel }
  const question = { questionsFile: item.delegation.questionsFile, questionId: item.delegation.questionId }
  await answerQuestion(source, record, { ...question, answer, author }, format)
  await resolveDelegations(source, record, question, author)
}
