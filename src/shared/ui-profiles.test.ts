import { describe, expect, it } from 'vitest'
import { findUiProfileHomeTabKey, isUiSurfaceVisible } from './ui-profiles'

describe('STK UI profiles', () => {
  it('treats an unset or unknown profile as dev, which hides nothing', () => {
    expect(isUiSurfaceVisible(undefined, 'workspace-workbench')).toBe(true)
    expect(isUiSurfaceVisible('qa', 'workspace-sidebar')).toBe(true)
    expect(isUiSurfaceVisible('po', 'workspace-workbench')).toBe(false)
  })

  it('finds the PO home panel whatever publisher installed the plugin', () => {
    const installed = [
      'plugin:acme.notes/main',
      'plugin:local.aidlc/aidlc',
      'plugin:local.aidlc/inbox'
    ]
    expect(findUiProfileHomeTabKey('po', installed)).toBe('plugin:local.aidlc/inbox')
    expect(findUiProfileHomeTabKey('po', ['plugin:stk.aidlc/inbox'])).toBe('plugin:stk.aidlc/inbox')
    expect(findUiProfileHomeTabKey('po', ['plugin:acme.notaidlc/inbox'])).toBeNull()
    expect(findUiProfileHomeTabKey('dev', installed)).toBeNull()
  })
})
