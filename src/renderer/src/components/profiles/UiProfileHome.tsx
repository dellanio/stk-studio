// STK Studio (stk/docs/patches.md #1): the center page of a profile that hides the workbench.
// It opens the profile's home panel once per session; workspaces keep running underneath.
import { useEffect } from 'react'
import { Inbox } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
import { openUiProfileHomePanel, useUiProfileHomeTabKey } from './ui-profile-home-panel'

let homePanelOpenedThisSession = false

export function UiProfileHome(): React.JSX.Element {
  const t = useTranslate()
  const tabKey = useUiProfileHomeTabKey()
  const persistedUIReady = useAppStore((s) => s.persistedUIReady)
  const pluginSystemEnabled = useAppStore((s) => s.settings?.pluginSystemEnabled === true)
  const updateSettings = useAppStore((s) => s.updateSettings)

  useEffect(() => {
    // Why after hydration: restoring the persisted sidebar route would replace the tab set earlier.
    if (tabKey && persistedUIReady && pluginSystemEnabled && !homePanelOpenedThisSession) {
      homePanelOpenedThisSession = true
      openUiProfileHomePanel(tabKey)
    }
  }, [tabKey, persistedUIReady, pluginSystemEnabled])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {t('stk.profile.home.title', 'Product Owner mode')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {!pluginSystemEnabled
            ? t(
                'stk.profile.home.pluginsOff',
                'Turn on plugins in Settings → Plugins to see your inbox.'
              )
            : tabKey
              ? t(
                  'stk.profile.home.description',
                  'Questions sent to you, story review and project status live in the panel on the right.'
                )
              : t(
                  'stk.profile.home.missingPlugin',
                  'Install the STK AIDLC plugin (stk/plugins/aidlc) to see your inbox.'
                )}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {tabKey && pluginSystemEnabled ? (
            <Button onClick={() => openUiProfileHomePanel(tabKey)}>
              {t('stk.profile.home.openInbox', 'Open inbox')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => updateSettings({ uiProfile: 'dev' })}>
            {t('stk.profile.home.switchToDev', 'Switch to Dev mode')}
          </Button>
        </div>
      </div>
    </div>
  )
}
