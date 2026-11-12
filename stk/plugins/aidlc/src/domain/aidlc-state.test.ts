import { readFileSync } from 'node:fs'
import { assert, test } from 'orca/testing'
import { parseState, phaseProgress } from './aidlc-state'

const fixture = (path: string): string =>
  readFileSync(new URL(`../../fixtures/${path}`, import.meta.url), 'utf8')

test('v1 state: phases, stage plans and progress', () => {
  const state = parseState(fixture('v1/aidlc-docs/aidlc-state.md'))
  assert.deepEqual(
    state.phases.map((phase) => phase.id),
    ['inception', 'construction', 'operations']
  )
  const inception = state.phases[0]
  assert.deepEqual(inception.stages[1], { name: 'Reverse Engineering', status: 'skipped', plan: null })
  assert.deepEqual(inception.stages[3], { name: 'User Stories', status: 'pending', plan: 'EXECUTE' })
  assert.deepEqual(inception.stages[6], { name: 'Units Generation', status: 'skipped', plan: 'SKIP' })
  assert.deepEqual(phaseProgress(inception), { done: 3, total: 5, percent: 60 })
  assert.equal(state.currentStage, 'INCEPTION - User Stories')
})

test('v2 state: slugs, every checkbox state and the per-unit line', () => {
  const state = parseState(
    fixture('v2/aidlc/spaces/default/intents/261104-reembolso/aidlc-state.md')
  )
  assert.deepEqual(
    state.phases.map((phase) => phase.id),
    ['initialization', 'ideation', 'inception', 'construction', 'operations']
  )
  const inception = state.phases[2]
  assert.deepEqual(
    inception.stages.map((stage) => [stage.name, stage.status]),
    [
      ['reverse-engineering', 'skipped'],
      ['practices-discovery', 'done'],
      ['requirements-analysis', 'in-progress'],
      ['user-stories', 'awaiting-approval'],
      ['application-design', 'pending'],
      ['units-generation', 'pending']
    ]
  )
  assert.equal(state.phases[3].stages.length, 3)
  assert.equal(state.currentStage, 'requirements-analysis')
})
