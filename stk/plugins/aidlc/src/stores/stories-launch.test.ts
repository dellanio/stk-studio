import { readFileSync } from 'node:fs'
import { assert, test } from 'orca/testing'
import { parseStories } from '../domain/aidlc-stories'
import { buildIssueFields, createFakeJiraClient, type JiraConfig } from '../jira/jira-client'
import { createMemoryFileSource } from '../sources/memory-file-source'
import { launchStories } from './stories-launch'

const STORIES = 'inception/user-stories/stories.md'
const record = { root: 'aidlc-docs', layout: 'aidlc-docs' as const, label: 'aidlc-docs' }
const fixture = readFileSync(
  new URL(`../../fixtures/v1/aidlc-docs/${STORIES}`, import.meta.url),
  'utf8'
)

test('launches the epic and the selected stories, writes keys back, never relaunches', async () => {
  const source = createMemoryFileSource('demo', { [`aidlc-docs/${STORIES}`]: fixture }, 'local')
  const jira = createFakeJiraClient('FIN', 10)
  const result = await launchStories(source, record, jira, {
    storiesFile: STORIES,
    stories: [
      {
        id: 'US-001',
        summary: 'Enviar despesa',
        description: 'Editada pelo PO',
        acceptanceCriteria: ['AC editado']
      },
      { id: 'US-003', summary: 'Aprovar pedido', description: 'x', acceptanceCriteria: [] }
    ],
    newEpic: { summary: 'Reembolso', description: '' },
    author: 'PO Demo'
  })
  assert.equal(result.epic?.key, 'FIN-10')
  assert.deepEqual(
    result.created.map((item) => [item.storyId, item.key]),
    [
      ['US-001', 'FIN-11'],
      ['US-003', 'FIN-12']
    ]
  )
  assert.deepEqual(
    jira.issues.map((issue) => [issue.key, issue.kind, issue.epicKey, issue.description]),
    [
      ['FIN-10', 'epic', null, ''],
      ['FIN-11', 'story', 'FIN-10', 'Editada pelo PO'],
      ['FIN-12', 'story', 'FIN-10', 'x']
    ]
  )
  const written = parseStories(source.files.get(`aidlc-docs/${STORIES}`) ?? '')
  assert.equal(written.epicJiraKey, 'FIN-10')
  assert.deepEqual(
    written.stories.map((story) => story.jiraKey),
    ['FIN-11', null, 'FIN-12']
  )

  const again = await launchStories(source, record, jira, {
    storiesFile: STORIES,
    stories: [{ id: 'US-001', summary: 'x', description: 'x', acceptanceCriteria: [] }],
    newEpic: null,
    author: 'PO Demo'
  })
  assert.deepEqual(again.skipped, ['US-001'])
  assert.equal(again.written, false)
  assert.equal(jira.issues.length, 3)
})

const config: JiraConfig = {
  baseUrl: 'https://jira.example.invalid',
  deployment: 'cloud',
  projectKey: 'FIN',
  epicIssueType: 'Epic',
  storyIssueType: 'Story',
  email: 'po@example.invalid',
  token: 't',
  acceptanceCriteriaField: '',
  epicLinkField: 'customfield_10008',
  epicNameField: 'customfield_10011',
  labels: ['aidlc']
}
const story = { summary: 'S', description: 'D', acceptanceCriteria: ['C1', 'C2'], epicKey: 'FIN-1' }

test('Cloud: ADF description with the criteria, epic as parent', () => {
  const fields = buildIssueFields(config, 'story', story)
  assert.deepEqual(fields.parent, { key: 'FIN-1' })
  assert.equal(fields.customfield_10008, undefined)
  const description = fields.description as {
    content: { type: string; content?: { text?: string }[] }[]
  }
  assert.deepEqual(
    description.content.map((node) => [node.type, node.content?.[0]?.text ?? null]),
    [
      ['paragraph', 'D'],
      ['paragraph', 'Critérios de aceite:'],
      ['bulletList', null]
    ]
  )
})

test('Data Center: wiki text, Epic Link field, criteria in their own field', () => {
  const dc = {
    ...config,
    deployment: 'datacenter' as const,
    acceptanceCriteriaField: 'customfield_20000'
  }
  const fields = buildIssueFields(dc, 'story', story)
  assert.equal(fields.description, 'D')
  assert.equal(fields.customfield_20000, '* C1\n* C2')
  assert.equal(fields.customfield_10008, 'FIN-1')
  assert.equal(fields.parent, undefined)
  assert.equal(buildIssueFields(dc, 'epic', { ...story, epicKey: null }).customfield_10011, 'S')
})
