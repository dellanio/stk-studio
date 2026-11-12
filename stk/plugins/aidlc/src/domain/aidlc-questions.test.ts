import { readFileSync } from 'node:fs'
import { assert, test } from 'orca/testing'
import { parseQuestions, pendingQuestions, writeAnswer } from './aidlc-questions'

const fixture = (path: string): string =>
  readFileSync(new URL(`../../fixtures/${path}`, import.meta.url), 'utf8')

const V1 = 'v1/aidlc-docs/inception/requirements/requirement-verification-questions.md'
const V2 =
  'v2/aidlc/spaces/default/intents/261104-reembolso/inception/requirements-analysis/requirements-analysis-questions.md'

/** Lines of `after` that differ from `before`, which must have the same line count. */
function changedLines(before: string, after: string): string[] {
  const a = before.split('\n')
  const b = after.split('\n')
  assert.equal(b.length, a.length)
  return b.filter((line, index) => line !== a[index])
}

test('v1: reads numbered questions, options and the letter answers', () => {
  const doc = parseQuestions(fixture(V1))
  assert.equal(doc.format, 'aidlc-v1')
  assert.deepEqual(
    doc.questions.map((q) => q.id),
    ['Q1', 'Q2', 'Q3', 'Q4']
  )
  assert.equal(doc.questions[1].title, 'What is the approval chain for a request?')
  assert.deepEqual(
    doc.questions[1].options.map((o) => [o.letter, o.isOther]),
    [
      ['A', false],
      ['B', false],
      ['C', false],
      ['X', true]
    ]
  )
  assert.deepEqual(doc.questions[0].answer, { letters: ['A'] })
  assert.equal(doc.questions[2].multiSelect, true)
  assert.deepEqual(
    pendingQuestions(doc).map((q) => q.id),
    ['Q2', 'Q3', 'Q4']
  )
})

test('v1: writing an answer changes only that [Answer]: line and reads back', () => {
  const before = fixture(V1)
  const after = writeAnswer(before, 'Q2', { letters: ['B'] })
  assert.deepEqual(changedLines(before, after), ['[Answer]: B'])
  assert.deepEqual(parseQuestions(after).questions[1].answer, { letters: ['B'] })

  const other = writeAnswer(after, 'Q4', { letters: ['X'], otherText: 'Até o dia 15 do mês seguinte' })
  assert.deepEqual(changedLines(after, other), ['[Answer]: X) Até o dia 15 do mês seguinte'])
  assert.deepEqual(parseQuestions(other).questions[3].answer, {
    letters: ['X'],
    otherText: 'Até o dia 15 do mês seguinte'
  })
})

test('v2: reads trades and labelled answers, writes letter + label', () => {
  const before = fixture(V2)
  const doc = parseQuestions(before)
  assert.equal(doc.format, 'aidlc-v2')
  assert.equal(doc.questions[0].trade, 'Product owner')
  assert.equal(doc.questions[0].title, 'Quem pode pedir reembolso?')
  assert.deepEqual(doc.questions[0].answer, { letters: ['A'] })
  assert.equal(doc.questions[1].prompt, 'Precisamos saber quem aprova antes de desenhar as telas.')
  assert.equal(doc.questions[3].trade, 'Developer')

  const single = writeAnswer(before, 'Q2', { letters: ['B'] })
  assert.deepEqual(changedLines(before, single), ['[Answer]: B. Gestor direto e depois o financeiro'])

  const multi = writeAnswer(single, 'Q3', { letters: ['A', 'C'] })
  assert.deepEqual(changedLines(single, multi), ['[Answer]: A, C'])
  assert.deepEqual(parseQuestions(multi).questions[2].answer, { letters: ['A', 'C'] })

  const other = writeAnswer(multi, 'Q4', { letters: ['X'], otherText: 'Bucket do time de finanças' })
  assert.deepEqual(changedLines(multi, other), ['[Answer]: X. Bucket do time de finanças'])
})

test('keeps CRLF endings and every other byte', () => {
  const crlf = fixture(V2).replace(/\n/g, '\r\n')
  const after = writeAnswer(crlf, 'Q2', { letters: ['C'] })
  const expected = crlf.replace(/(## Q2\.[\s\S]*?)\[Answer\]:\r\n/, '$1[Answer]: C. Só o financeiro\r\n')
  assert.notEqual(expected, crlf)
  assert.equal(after, expected)
})

test('refuses answers the question does not offer', () => {
  const source = fixture(V2)
  assert.throws(() => writeAnswer(source, 'Q2', { letters: ['Z'] }), /Opção inexistente/)
  assert.throws(() => writeAnswer(source, 'Q2', { letters: ['A', 'B'] }), /única opção/)
  assert.throws(() => writeAnswer(source, 'Q2', { letters: ['X'] }), /texto livre/)
  assert.throws(() => writeAnswer(source, 'Q9', { letters: ['A'] }), /não encontrada/)
})
