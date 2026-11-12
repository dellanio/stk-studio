// The panel ↔ worker contract, declared once: the panels and src/worker/worker.ts both read it.
import type { AidlcAnswer, AidlcQuestion } from './domain/aidlc-questions'
import type { AidlcRecordRef } from './domain/aidlc-record'
import type { AidlcStory } from './domain/aidlc-stories'
import type { AidlcPhaseId, AidlcStageStatus } from './domain/aidlc-state'
import type { Delegation } from './domain/delegations'
import type { RecordSnapshot } from './stores/aidlc-record-store'
import type { LaunchResult, StoryForLaunch } from './stores/stories-launch'

export type PhaseView = {
  id: AidlcPhaseId
  label: string
  percent: number
  done: number
  total: number
  stages: { name: string; label: string; status: AidlcStageStatus; statusLabel: string }[]
}

export type DevLoadResult = {
  workspace: { name: string; branch: string } | null
  /** Why there is nothing to show: no workspace, a remote one, or no aidlc record. */
  notice: string | null
  records: AidlcRecordRef[]
  snapshot: RecordSnapshot | null
  phases: PhaseView[]
  currentStage: string | null
  defaultAssignee: string
}

export type GitSyncResult = { committed: boolean; pushed: boolean; message: string }

export type InboxItem = {
  key: string
  projectLabel: string
  recordRoot: string
  recordLabel: string
  delegation: Delegation
  phaseLabel: string
  stageLabel: string
  /** The question as the file reads now; null when it is gone from the file. */
  question: AidlcQuestion | null
}

export type ProjectStatusView = {
  projectLabel: string
  error: string | null
  records: { label: string; root: string; phases: PhaseView[]; pendingQuestions: number }[]
}

export type InboxResult = {
  configured: boolean
  demo: boolean
  checkedAt: number | null
  items: InboxItem[]
  projects: ProjectStatusView[]
  errors: string[]
}

export type ConfigStatus = {
  githubTokenSet: boolean
  jiraTokenSet: boolean
  secretsAvailable: boolean
  demo: boolean
  projects: string[]
}

export type StoriesSource = {
  id: string
  label: string
  storiesFiles: string[]
}

export type StoriesLoadResult = {
  sourceId: string
  storiesFile: string
  epicJiraKey: string | null
  stories: AidlcStory[]
  jiraTarget: string
}

declare module 'orca' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
  interface PluginRequests {
    'dev.load': { input: { recordRoot?: string }; output: DevLoadResult }
    'dev.answer': {
      input: { recordRoot: string; questionsFile: string; questionId: string; answer: AidlcAnswer }
      output: DevLoadResult
    }
    'dev.delegate': {
      input: {
        recordRoot: string
        questionsFile: string
        questionId: string
        assignedTo: string
        note: string
      }
      output: { result: DevLoadResult; git: GitSyncResult }
    }
    'dev.notifyAgent': {
      input: { recordRoot: string; questionsFile: string }
      output: { message: string }
    }
    'dev.openFile': { input: { recordRoot: string; path: string }; output: { opened: boolean } }
    'dev.pull': {
      input: { recordRoot?: string }
      output: { result: DevLoadResult; message: string }
    }
    'inbox.load': { input: { refresh: boolean }; output: InboxResult }
    'inbox.answer': {
      input: { itemKey: string; answer: AidlcAnswer }
      output: InboxResult
    }
    'config.status': { input: Record<string, never>; output: ConfigStatus }
    'config.setSecret': {
      input: { key: 'githubToken' | 'jiraToken'; value: string }
      output: ConfigStatus
    }
    'stories.sources': {
      input: Record<string, never>
      output: { sources: StoriesSource[]; notice: string | null }
    }
    'stories.load': { input: { sourceId: string; storiesFile: string }; output: StoriesLoadResult }
    'stories.launch': {
      input: {
        sourceId: string
        storiesFile: string
        stories: StoryForLaunch[]
        newEpic: { summary: string; description: string } | null
      }
      output: { result: LaunchResult; reloaded: StoriesLoadResult }
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
  interface PluginPanelEvents {
    'inbox.changed': { pending: number }
  }
}
