// The delegation ledger kept in the repository (`<record>/.stk/delegations.json`): which question
// a developer sent to the PO, and whether it was answered. Pure; stores do the reading/writing.
import { isRecord } from './json-value'

export type DelegationStatus = 'pending' | 'answered' | 'cancelled'

export type Delegation = {
  id: string
  /** Record-relative questions file: `inception/requirements/requirements-questions.md`. */
  questionsFile: string
  questionId: string
  questionTitle: string
  phase: string | null
  stage: string | null
  requestedBy: string
  assignedTo: string
  requestedAt: string
  note?: string
  status: DelegationStatus
  answeredBy?: string
  answeredAt?: string
}

export type DelegationLedger = { version: 1; delegations: Delegation[] }

function isDelegation(item: unknown): item is Delegation {
  return (
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.questionsFile === 'string' &&
    typeof item.questionId === 'string'
  )
}

export function parseLedger(text: string | null): DelegationLedger {
  if (!text?.trim()) {
    return { version: 1, delegations: [] }
  }
  const parsed: unknown = JSON.parse(text)
  const list = isRecord(parsed) && Array.isArray(parsed.delegations) ? parsed.delegations : []
  return { version: 1, delegations: list.filter(isDelegation) }
}

export function serializeLedger(ledger: DelegationLedger): string {
  return `${JSON.stringify(ledger, null, 2)}\n`
}

export type NewDelegation = Omit<Delegation, 'id' | 'status' | 'requestedAt'>

/** Adds a pending delegation; one already pending for the same question is reassigned instead. */
export function addDelegation(
  ledger: DelegationLedger,
  input: NewDelegation,
  now: Date,
  newId: () => string
): { ledger: DelegationLedger; delegation: Delegation } {
  const existing = ledger.delegations.find(
    (item) =>
      item.status === 'pending' &&
      item.questionsFile === input.questionsFile &&
      item.questionId === input.questionId
  )
  const delegation: Delegation = existing
    ? { ...existing, ...input, requestedAt: now.toISOString() }
    : { ...input, id: newId(), status: 'pending', requestedAt: now.toISOString() }
  const others = ledger.delegations.filter((item) => item.id !== delegation.id)
  return { ledger: { version: 1, delegations: [...others, delegation] }, delegation }
}

/** Marks every pending delegation of that question answered (the file is the source of truth). */
export function markAnswered(
  ledger: DelegationLedger,
  question: { questionsFile: string; questionId: string },
  answeredBy: string,
  now: Date
): DelegationLedger {
  return {
    version: 1,
    delegations: ledger.delegations.map((item) =>
      item.status === 'pending' &&
      item.questionsFile === question.questionsFile &&
      item.questionId === question.questionId
        ? { ...item, status: 'answered', answeredBy, answeredAt: now.toISOString() }
        : item
    )
  }
}
