// STK Studio (stk/docs/patches.md #1): UI profiles are experience, not permission. A profile only
// hides UI surfaces and names a plugin panel to open first; adding a role is one entry here.

export const UI_PROFILE_IDS = ['dev', 'po'] as const
export type UiProfileId = (typeof UI_PROFILE_IDS)[number]

export type UiSurface =
  /** The left sidebar: projects, worktrees and its nav (tasks, skills, automations...). */
  | 'workspace-sidebar'
  /** Terminals, editor, diffs and browser panes. Kept mounted while hidden. */
  | 'workspace-workbench'
  /** Built-in right sidebar tabs (explorer, source control, checks, ports...); plugin tabs stay. */
  | 'right-sidebar-builtin-tabs'

/** A plugin panel matched by manifest id, whatever publisher installed it (`stk`, `local`...). */
export type UiProfileHomePanel = { pluginId: string; panelId: string }

export type UiProfile = {
  id: UiProfileId
  hiddenSurfaces: readonly UiSurface[]
  homePanel: UiProfileHomePanel | null
}

export const UI_PROFILES: Record<UiProfileId, UiProfile> = {
  dev: { id: 'dev', hiddenSurfaces: [], homePanel: null },
  po: {
    id: 'po',
    hiddenSurfaces: ['workspace-sidebar', 'workspace-workbench', 'right-sidebar-builtin-tabs'],
    homePanel: { pluginId: 'aidlc', panelId: 'inbox' }
  }
}

export function isUiProfileId(value: unknown): value is UiProfileId {
  return UI_PROFILE_IDS.some((id) => id === value)
}

/** Unset or unknown values behave as `dev`, Orca's own experience. */
export function resolveUiProfile(value: unknown): UiProfile {
  return isUiProfileId(value) ? UI_PROFILES[value] : UI_PROFILES.dev
}

export function isUiSurfaceVisible(profileValue: unknown, surface: UiSurface): boolean {
  return !resolveUiProfile(profileValue).hiddenSurfaces.includes(surface)
}

/** The installed tab key of the profile's home panel (`plugin:<publisher>.<id>/<panel>`), if any. */
export function findUiProfileHomeTabKey(
  profileValue: unknown,
  installedTabKeys: readonly string[]
): `plugin:${string}` | null {
  const home = resolveUiProfile(profileValue).homePanel
  if (!home) {
    return null
  }
  const suffix = `.${home.pluginId}/${home.panelId}`
  const isHomeTab = (key: string): key is `plugin:${string}` =>
    key.startsWith('plugin:') && key.endsWith(suffix)
  return installedTabKeys.find(isHomeTab) ?? null
}
