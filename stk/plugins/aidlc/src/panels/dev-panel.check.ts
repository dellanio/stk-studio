// `orca plugin check` scenarios: the dev panel on the bundled v1 and v2 fixtures.
import { fileURLToPath } from 'node:url'
import { defineCheck } from 'orca/testing'

const workspace = (dir: string) => ({
  'workspace.readContext': { workspaceId: 'w1', branch: 'aidlc', displayName: 'reembolso', terminals: [] },
  'workspace.list': {
    workspaces: [
      {
        id: 'w1',
        kind: 'folder',
        name: 'reembolso',
        path: fileURLToPath(new URL(`../../fixtures/${dir}`, import.meta.url)),
        branch: 'aidlc',
        hostId: 'local'
      }
    ],
    truncated: false
  }
})

export default defineCheck({
  v1: { results: workspace('v1') },
  v2: { results: workspace('v2') },
  noWorkspace: { results: { 'workspace.readContext': null } }
})
