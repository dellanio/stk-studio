// STK Studio (stk/docs/patches.md #1): labels for each profile in src/shared/ui-profiles.ts.
import { useTranslate } from '@/i18n/use-translate'
import { UI_PROFILE_IDS, type UiProfileId } from '../../../../shared/ui-profiles'

export type UiProfileOption = { id: UiProfileId; label: string; description: string }

export function useUiProfileOptions(): UiProfileOption[] {
  const t = useTranslate()
  const text: Record<UiProfileId, Omit<UiProfileOption, 'id'>> = {
    dev: {
      label: t('stk.profile.dev.label', 'Developer'),
      description: t(
        'stk.profile.dev.description',
        'Workspaces, terminals, agents, diffs and the AIDLC panel.'
      )
    },
    po: {
      label: t('stk.profile.po.label', 'Product Owner'),
      description: t(
        'stk.profile.po.description',
        'Opens on your inbox: questions from developers, story review and phase status, without code.'
      )
    }
  }
  return UI_PROFILE_IDS.map((id) => ({ id, ...text[id] }))
}
