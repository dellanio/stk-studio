import { describe, expect, it } from 'vitest'
import type { ActiveRightSidebarTab } from '../../../../shared/ui-chrome-types'
import type { ActivityBarItem } from './activity-bar-buttons'
import { getVisibleRightSidebarActivityItems } from './right-sidebar-activity-visibility'

const Icon = (): null => null
const item = (id: ActiveRightSidebarTab): ActivityBarItem => ({
  id,
  icon: Icon,
  title: id,
  shortcut: ''
})
const local = { isFolder: false, isFolderWorkspace: false, hasSshHost: false }

describe('STK profile: hiding built-in right sidebar tabs', () => {
  it('keeps only plugin tabs', () => {
    const items = [
      item('explorer'),
      item('vault'),
      item('plugin:stk.aidlc/inbox'),
      item('plugin:local.aidlc/aidlc')
    ]
    expect(
      getVisibleRightSidebarActivityItems(items, { ...local, hideBuiltinTabs: true }).map(
        (entry) => entry.id
      )
    ).toEqual(['plugin:stk.aidlc/inbox', 'plugin:local.aidlc/aidlc'])
  })

  it('keeps the built-in tabs when no plugin panel exists, so the sidebar never goes empty', () => {
    const items = [item('explorer'), item('vault')]
    expect(
      getVisibleRightSidebarActivityItems(items, { ...local, hideBuiltinTabs: true }).map(
        (entry) => entry.id
      )
    ).toEqual(['explorer', 'vault'])
  })
})
