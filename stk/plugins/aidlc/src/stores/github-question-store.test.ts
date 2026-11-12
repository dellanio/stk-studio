import { readFileSync } from 'node:fs'
import { assert, test } from 'orca/testing'
import { parseQuestions } from '../domain/aidlc-questions'
import { parseLedger } from '../domain/delegations'
import { startFakeGitHub } from '../sources/github-fake-server'
import { createGitHubFileSource } from '../sources/github-file-source'
import {
  answerQuestion,
  discoverRecords,
  loadRecordSnapshot,
  resolveDelegations
} from './aidlc-record-store'

const ROOT = 'aidlc/spaces/default/intents/261104-reembolso'
const QUESTIONS = 'inception/requirements-analysis/requirements-analysis-questions.md'
const seed = Object.fromEntries(
  ['aidlc-state.md', QUESTIONS, 'inception/user-stories/stories.md', '.stk/delegations.json'].map(
    (path) => [
      `${ROOT}/${path}`,
      readFileSync(new URL(`../../fixtures/v2/${ROOT}/${path}`, import.meta.url), 'utf8')
    ]
  )
)
const project = { owner: 'acme', repo: 'reembolso', branch: 'aidlc' }

test('PO answers through the GitHub API: answer commit, then the delegation closes', async () => {
  const github = await startFakeGitHub({ ...project, token: 'test-token', files: seed })
  try {
    const source = createGitHubFileSource({ project, token: 'test-token', apiUrl: github.url })
    const [record] = await discoverRecords(source)
    assert.deepEqual(record, { root: ROOT, layout: 'intent', label: '261104-reembolso' })

    const snapshot = await loadRecordSnapshot(source, record)
    assert.deepEqual(
      snapshot.delegations
        .filter((item) => item.status === 'pending')
        .map((item) => item.questionId),
      ['Q2', 'Q3']
    )

    await answerQuestion(source, record, {
      questionsFile: QUESTIONS,
      questionId: 'Q2',
      answer: { letters: ['B'] },
      author: 'PO Demo'
    })
    assert.equal(
      await resolveDelegations(
        source,
        record,
        { questionsFile: QUESTIONS, questionId: 'Q2' },
        'PO Demo'
      ),
      true
    )

    const answered = parseQuestions(github.files.get(`${ROOT}/${QUESTIONS}`)?.content ?? '')
    assert.equal(answered.questions[1].rawAnswer, 'B. Gestor direto e depois o financeiro')
    const ledger = parseLedger(github.files.get(`${ROOT}/.stk/delegations.json`)?.content ?? null)
    assert.deepEqual(
      ledger.delegations.map((item) => [item.questionId, item.status, item.answeredBy ?? null]),
      [
        ['Q2', 'answered', 'PO Demo'],
        ['Q3', 'pending', null]
      ]
    )
    assert.deepEqual(
      github.commits.map((commit) => [commit.path, commit.branch]),
      [
        [`${ROOT}/${QUESTIONS}`, 'aidlc'],
        [`${ROOT}/.stk/delegations.json`, 'aidlc']
      ]
    )
  } finally {
    await github.close()
  }
})

test('a change made in the repository after the read is a conflict, not an overwrite', async () => {
  const github = await startFakeGitHub({ ...project, token: 'test-token', files: seed })
  try {
    const source = createGitHubFileSource({ project, token: 'test-token', apiUrl: github.url })
    const record = { root: ROOT, layout: 'intent' as const, label: 'x' }
    const original = source.readFile
    source.readFile = async (path) => {
      const file = await original(path)
      github.files.set(path, { content: 'changed by someone else', sha: 'sha-other' })
      return file
    }
    await assert.rejects(
      answerQuestion(source, record, {
        questionsFile: QUESTIONS,
        questionId: 'Q2',
        answer: { letters: ['A'] },
        author: 'PO'
      }),
      /mudou desde a última leitura/
    )
    assert.equal(github.commits.length, 0)
  } finally {
    await github.close()
  }
})

test('a bad token is reported in plain words', async () => {
  const github = await startFakeGitHub({ ...project, token: 'test-token', files: seed })
  try {
    const source = createGitHubFileSource({ project, token: 'wrong', apiUrl: github.url })
    await assert.rejects(discoverRecords(source), /Token do GitHub inválido/)
  } finally {
    await github.close()
  }
})
