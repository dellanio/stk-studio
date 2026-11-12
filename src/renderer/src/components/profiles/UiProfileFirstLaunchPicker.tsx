// STK Studio (stk/docs/patches.md #1): first-run role choice. Shown once, while `uiProfile` is
// unset; the choice can change later in Settings → General.
import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import type { UiProfileId } from '../../../../shared/ui-profiles'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { useUiProfileOptions } from './ui-profile-options'

export function UiProfileFirstLaunchPicker({
  suppressed
}: {
  suppressed: boolean
}): React.JSX.Element | null {
  const t = useTranslate()
  const chosen = useAppStore((s) => (s.settings ? s.settings.uiProfile !== undefined : true))
  const updateSettings = useAppStore((s) => s.updateSettings)
  const options = useUiProfileOptions()
  const [choice, setChoice] = useState<UiProfileId>('dev')
  const [dismissedThisSession, setDismissedThisSession] = useState(false)

  if (chosen || suppressed || dismissedThisSession) {
    return null
  }

  const confirm = (): void => {
    setDismissedThisSession(true)
    updateSettings({ uiProfile: choice })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : confirm())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('stk.profile.picker.title', 'How will you use STK Studio?')}</DialogTitle>
          <DialogDescription>
            {t(
              'stk.profile.picker.description',
              'The profile only changes what you see, not what you can do. You can switch later in Settings → General.'
            )}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={choice}
          onValueChange={(value) => setChoice(value as UiProfileId)}
          className="gap-2"
        >
          {options.map((option) => (
            <Label
              key={option.id}
              htmlFor={`ui-profile-${option.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent"
            >
              <RadioGroupItem id={`ui-profile-${option.id}`} value={option.id} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button onClick={confirm}>{t('stk.profile.picker.continue', 'Continue')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
