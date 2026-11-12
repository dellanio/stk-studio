// `orca plugin check` scenario: stories of the demo projects.
import { defineCheck } from 'orca/testing'

export default defineCheck({
  demo: { settings: { demoMode: true }, results: { 'workspace.readContext': null } }
})
