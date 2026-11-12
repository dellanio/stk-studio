import { readFileSync } from 'node:fs'
import { assert, test } from 'orca/testing'
import { parseStories, writeJiraKeys } from './aidlc-stories'

const fixture = (path: string): string =>
  readFileSync(new URL(`../../fixtures/${path}`, import.meta.url), 'utf8')

const V1 = 'v1/aidlc-docs/inception/user-stories/stories.md'
const V2 = 'v2/aidlc/spaces/default/intents/261104-reembolso/inception/user-stories/stories.md'

test('v1 stories: ids, epics, statement, priority and criteria', () => {
  const doc = parseStories(fixture(V1))
  assert.deepEqual(
    doc.stories.map((story) => [story.id, story.title, story.epic]),
    [
      ['US-001', 'Submit an expense request', 'Expense submission'],
      ['US-002', 'Track my requests', 'Expense submission'],
      ['US-003', 'Approve a request', 'Approval']
    ]
  )
  assert.equal(
    doc.stories[0].description,
    'As an employee, I want to submit an expense with its receipt, so that I get reimbursed.'
  )
  assert.equal(doc.stories[0].priority, 'Must Have')
  assert.deepEqual(doc.stories[2].acceptanceCriteria, [
    'Given a pending request, when I approve it, then it moves to finance.',
    'Given a pending request, when I reject it with a reason, then the employee is notified.'
  ])
})

test('v2 stories: US/AC ids', () => {
  const doc = parseStories(fixture(V2))
  assert.deepEqual(
    doc.stories.map((story) => story.id),
    ['US1.1', 'US1.2']
  )
  assert.equal(doc.stories[0].epic, 'Pedido de reembolso')
  assert.equal(
    doc.stories[0].acceptanceCriteria[0],
    'AC1.1.1: Given I am signed in, when I attach a receipt and submit, then the request is created as pending.'
  )
})

test('Jira keys go back into the artifact, replace older ones and change nothing else', () => {
  const before = fixture(V1)
  const once = writeJiraKeys(before, {
    stories: { 'US-001': 'FIN-11', 'US-003': 'FIN-12' },
    epic: 'FIN-10'
  })
  const doc = parseStories(once)
  assert.equal(doc.epicJiraKey, 'FIN-10')
  assert.deepEqual(
    doc.stories.map((story) => story.jiraKey),
    ['FIN-11', null, 'FIN-12']
  )
  assert.equal(once.replace(/\n\nJira(-Epic)?: FIN-\d+(?=\n)/g, ''), before)

  const again = writeJiraKeys(once, { stories: { 'US-001': 'FIN-21' } })
  assert.deepEqual(
    parseStories(again).stories.map((story) => story.jiraKey),
    ['FIN-21', null, 'FIN-12']
  )
  assert.equal(again.split('\n').length, once.split('\n').length)
})
