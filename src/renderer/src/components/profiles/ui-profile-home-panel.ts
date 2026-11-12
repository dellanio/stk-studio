// STK Studio (stk/docs/patches.md #1): find and open the active profile's home plugin panel.
import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { usePluginPanels } from '@/store/plugins/catalog/plugin-contribution-catalog'
import { findUiProfileHomeTabKey } from '../../../../shared/ui-profiles'

export function useUiProfileHomeTabKey(): `plugin:${string}` | null {
  const profile = useAppStore((s) => s.settings?.uiProfile)
  const panels = usePluginPanels()
  return useMemo(
    () =>
      findUiProfileHomeTabKey(
        profile,
        panels.map((panel) => panel.tabKey)
      ),
    [profile, panels]
  )
}

export function openUiProfileHomePanel(tabKey: `plugin:${string}`): void {
  const state = useAppStore.getState()
  state.setRightSidebarTab(tabKey)
  state.setRightSidebarOpen(true)
}
