// `orca plugin check` scenarios: demo projects, and nothing configured yet.
import { defineCheck } from 'orca/testing'

export default defineCheck({
  demo: { settings: { demoMode: true } },
  unconfigured: {}
})
