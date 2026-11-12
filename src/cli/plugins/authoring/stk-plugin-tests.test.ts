// STK Studio (stk/docs/patches.md #2): every plugin in stk/plugins passes its own tests, in CI too.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findPluginTestFiles, runPluginTests } from './plugin-test-runner'

const STK_PLUGINS = resolve(__dirname, '../../../../stk/plugins')
const TESTED_PLUGINS = existsSync(STK_PLUGINS)
  ? readdirSync(STK_PLUGINS).filter((name) =>
      existsSync(join(STK_PLUGINS, name, 'orca-plugin.json'))
    )
  : []

describe.skipIf(TESTED_PLUGINS.length === 0)('the STK plugins', () => {
  it.each(TESTED_PLUGINS)(
    '%s passes its own tests',
    async (plugin) => {
      const dir = join(STK_PLUGINS, plugin)
      const files = await findPluginTestFiles(dir)
      expect(files.length).toBeGreaterThan(0)
      expect(await runPluginTests({ dir, files, quietStdout: true })).toMatchObject({
        runner: 'node',
        code: 0
      })
    },
    // Each run starts its own Node process and transpiles the plugin.
    120_000
  )
})
