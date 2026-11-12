// STK Studio (stk/docs/patches.md #1): switch the UI profile chosen at first run.
import type React from 'react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { resolveUiProfile, type UiProfileId } from '../../../../../shared/ui-profiles'
import { useTranslate } from '@/i18n/use-translate'
import { useUiProfileOptions } from '../../profiles/ui-profile-options'
import { Label } from '../../ui/label'
import { SettingsSegmentedControl } from '../form-controls/SettingsFormControls'
import { SearchableSetting } from '../section-layout/SearchableSetting'

export const UI_PROFILE_SEARCH_ENTRY = {
  title: 'Profile',
  keywords: ['profile', 'perfil', 'role', 'papel', 'dev', 'po', 'product owner']
}

export function UiProfileSetting({
  settings,
  updateSettings
}: {
  settings: Pick<GlobalSettings, 'uiProfile'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const t = useTranslate()
  const options = useUiProfileOptions()
  const title = t('stk.profile.setting.title', 'Profile')
  const description = t(
    'stk.profile.setting.description',
    'Changes what the app shows, not what you can do. Product Owner opens on the inbox and hides workspaces, terminals and diffs.'
  )
  return (
    <SearchableSetting
      title={title}
      description={description}
      keywords={UI_PROFILE_SEARCH_ENTRY.keywords}
      className="flex items-center justify-between gap-4 py-3"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <SettingsSegmentedControl<UiProfileId>
        ariaLabel={title}
        value={resolveUiProfile(settings.uiProfile).id}
        onChange={(uiProfile) => updateSettings({ uiProfile })}
        options={options.map((option) => ({ value: option.id, label: option.label }))}
      />
    </SearchableSetting>
  )
}
