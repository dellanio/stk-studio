import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import { parseQuestions } from '../domain/aidlc-questions'
import { parseLedger } from '../domain/delegations'
import * as main from './worker'

const QUESTIONS = 'inception/requirements/requirement-verification-questions.md'

async function checkout(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'stk-aidlc-'))
  for (const path of ['aidlc-state.md', QUESTIONS]) {
    const target = join(dir, 'aidlc-docs', ...path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(
      target,
      readFileSync(new URL(`../../fixtures/v1/aidlc-docs/${path}`, import.meta.url), 'utf8'),
      'utf8'
    )
  }
  return dir
}

function host(dir: string) {
  return mockHost({
    settings: {
      userName: 'Dev Teste',
      defaultPo: 'Ana PO',
      pushDelegations: false,
      pollMinutes: 60
    },
    results: {
      'workspace.readContext': {
        workspaceId: 'w1',
        branch: 'main',
        displayName: 'reembolso',
        terminals: []
      },
      'workspace.list': {
        workspaces: [
          { id: 'w1', kind: 'folder', name: 'reembolso', path: dir, branch: null, hostId: 'local' }
        ],
        truncated: false
      }
    }
  })
}

test('dev answers in the form and sends a question to the PO, all in the checkout', async () => {
  const dir = await checkout()
  try {
    const worker = await mountWorker(main, { host: host(dir) })
    const loaded = await worker.request('dev.load', {})
    assert.equal(loaded.snapshot?.record.root, 'aidlc-docs')
    assert.deepEqual(
      loaded.phases.map((phase) => phase.label),
      ['Fase de entendimento', 'Fase de construção', 'Fase de operação']
    )

    await worker.request('dev.answer', {
      recordRoot: 'aidlc-docs',
      questionsFile: QUESTIONS,
      questionId: 'Q3',
      answer: { letters: ['A', 'B'] }
    })
    const { result, git } = await worker.request('dev.delegate', {
      recordRoot: 'aidlc-docs',
      questionsFile: QUESTIONS,
      questionId: 'Q2',
      assignedTo: '',
      note: 'Precisa do financeiro?'
    })
    assert.equal(git.committed, false)
    assert.match(git.message, /não é um repositório git/)

    const file = parseQuestions(
      await readFile(join(dir, 'aidlc-docs', ...QUESTIONS.split('/')), 'utf8')
    )
    assert.equal(file.questions[2].rawAnswer, 'A, B')
    const ledger = parseLedger(
      await readFile(join(dir, 'aidlc-docs', '.stk', 'delegations.json'), 'utf8')
    )
    assert.deepEqual(
      ledger.delegations.map((item) => [
        item.questionId,
        item.assignedTo,
        item.requestedBy,
        item.status,
        item.note
      ]),
      [['Q2', 'Ana PO', 'Dev Teste', 'pending', 'Precisa do financeiro?']]
    )
    assert.deepEqual(
      result.snapshot?.delegations.map((item) => item.questionId),
      ['Q2']
    )
    await worker.deactivate()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
