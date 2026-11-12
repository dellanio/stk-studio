import type { ActivityBarItem } from './activity-bar-buttons'

type RightSidebarActivityVisibilityState = {
  isFolder: boolean
  isFolderWorkspace: boolean
  /** The workspace runs on an SSH host, reached directly or through its managed server. */
  hasSshHost: boolean
  /** STK Studio profile (stk/docs/patches.md #1): keep only plugin tabs. */
  hideBuiltinTabs?: boolean
}

export function getVisibleRightSidebarActivityItems(
  items: ActivityBarItem[],
  { isFolder, isFolderWorkspace, hasSshHost, hideBuiltinTabs }: RightSidebarActivityVisibilityState
): ActivityBarItem[] {
  const visible = items.filter(
    (item) =>
      (!item.gitOnly || !isFolder || (isFolderWorkspace && item.id === 'source-control')) &&
      (!item.folderOnly || isFolderWorkspace) &&
      (!item.sshOnly || hasSshHost)
  )
  if (!hideBuiltinTabs) {
    return visible
  }
  const pluginTabs = visible.filter((item) => item.id.startsWith('plugin:'))
  // Why: the effective-tab resolver needs at least one item, so with no plugin panel keep all.
  return pluginTabs.length > 0 ? pluginTabs : visible
}
