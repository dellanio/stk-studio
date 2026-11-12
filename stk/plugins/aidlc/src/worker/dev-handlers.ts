// Painel AIDLC do dev: read the local record, answer, delegate to the PO (commit + push), nudge
// the agent and open artifacts.
import type { OrcaWorkerApi } from 'orca/worker'
import { stringOf } from '../domain/json-value'
import type { DevLoadResult } from '../protocol'
import {
  answerQuestion,
  delegateQuestion,
  discoverRecords,
  loadRecordSnapshot,
  resolveDelegations
} from '../stores/aidlc-record-store'
import { commitAndPush, pullFastForward } from './git-sync'
import { readConfig } from './plugin-config'
import { phaseViews } from './record-views'
import {
  devAuthor,
  focusedWorkspace,
  localSource,
  requireRecord,
  requireWorkspace,
  UserFacingError
} from './worker-context'

const SELECTED_RECORD = 'dev.recordRoot'

export async function loadDev(orca: OrcaWorkerApi, requestedRoot?: string): Promise<DevLoadResult> {
  const config = await readConfig(orca)
  const empty: DevLoadResult = {
    workspace: null,
    notice: null,
    records: [],
    snapshot: null,
    phases: [],
    currentStage: null,
    defaultAssignee: config.defaultPo
  }
  const workspace = await focusedWorkspace(orca)
  if ('notice' in workspace) {
    return { ...empty, notice: workspace.notice }
  }
  const source = localSource(workspace)
  const records = await discoverRecords(source)
  const base = {
    ...empty,
    workspace: { name: workspace.name, branch: workspace.branch },
    records
  }
  if (records.length === 0) {
    return {
      ...base,
      notice: 'Esta workspace não tem aidlc-docs/ (nem aidlc/spaces/). Inicie o AI-DLC pelo agente.'
    }
  }
  const stored = requestedRoot ?? stringOf(await orca.storage.get(SELECTED_RECORD))
  const record = records.find((candidate) => candidate.root === stored) ?? records[0]
  if (requestedRoot) {
    await orca.storage.set(SELECTED_RECORD, record.root)
  }
  const snapshot = await loadRecordSnapshot(source, record, config.format)
  return {
    ...base,
    snapshot,
    phases: phaseViews(snapshot.state),
    currentStage: snapshot.state?.currentStage ?? null
  }
}

export function registerDevHandlers(orca: OrcaWorkerApi): void {
  orca.panels.handle('dev.load', ({ recordRoot }) => loadDev(orca, recordRoot))

  orca.panels.handle('dev.answer', async ({ recordRoot, questionsFile, questionId, answer }) => {
    const config = await readConfig(orca)
    const workspace = await requireWorkspace(orca)
    const source = localSource(workspace)
    const record = await requireRecord(source, recordRoot)
    const author = await devAuthor(config, workspace)
    await answerQuestion(
      source,
      record,
      { questionsFile, questionId, answer, author },
      config.format
    )
    await resolveDelegations(source, record, { questionsFile, questionId }, author)
    return loadDev(orca, recordRoot)
  })

  orca.panels.handle(
    'dev.delegate',
    async ({ recordRoot, questionsFile, questionId, assignedTo, note }) => {
      const config = await readConfig(orca)
      const workspace = await requireWorkspace(orca)
      const source = localSource(workspace)
      const record = await requireRecord(source, recordRoot)
      const snapshot = await loadRecordSnapshot(source, record, config.format)
      const file = snapshot.questionFiles.find((candidate) => candidate.path === questionsFile)
      const question = file?.questions.find((candidate) => candidate.id === questionId)
      if (!file || !question) {
        throw new UserFacingError(`Pergunta ${questionId} não encontrada em ${questionsFile}.`)
      }
      const requestedBy = await devAuthor(config, workspace)
      const delegation = await delegateQuestion(source, record, {
        questionsFile,
        questionId,
        questionTitle: question.title,
        phase: file.phase,
        stage: file.stage,
        requestedBy,
        assignedTo: assignedTo.trim() || config.defaultPo || 'PO',
        ...(note.trim() ? { note: note.trim() } : {})
      })
      const git = await commitAndPush(
        workspace.path,
        [`${record.root}/${questionsFile}`, `${record.root}/.stk/delegations.json`],
        `aidlc: ${questionId} enviada a ${delegation.assignedTo} por ${requestedBy}`,
        config.pushDelegations
      )
      return { result: await loadDev(orca, recordRoot), git }
    }
  )

  orca.panels.handle('dev.notifyAgent', async ({ recordRoot, questionsFile }) => {
    const { agents } = await orca.host.call('agents.list', {})
    const ready = agents.filter((agent) => agent.terminalId)
    const agent = ready.find((candidate) => candidate.state !== 'working') ?? ready[0]
    if (!agent?.terminalId) {
      throw new UserFacingError('Nenhum agente aberto nesta workspace.')
    }
    const text = `Atualizei as respostas em ${recordRoot}/${questionsFile}. Releia esse arquivo de perguntas e continue o workflow.`
    const { accepted } = await orca.host.call('terminal.sendText', {
      terminalId: agent.terminalId,
      text,
      enter: true
    })
    return {
      message: accepted
        ? `Aviso enviado para ${agent.title ?? agent.agent ?? 'o agente'}.`
        : 'O terminal não aceitou o aviso.'
    }
  })

  orca.panels.handle('dev.openFile', async ({ recordRoot, path }) => {
    const workspace = await requireWorkspace(orca)
    await orca.host.call('editor.open', {
      workspaceId: workspace.workspaceId,
      path: `${recordRoot}/${path}`
    })
    return { opened: true }
  })

  orca.panels.handle('dev.pull', async ({ recordRoot }) => {
    const workspace = await requireWorkspace(orca)
    const message = await pullFastForward(workspace.path)
    return { result: await loadDev(orca, recordRoot), message }
  })
}
