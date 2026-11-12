// STK Studio (stk/docs/patches.md #1): first-run role choice. Shown once, while `uiProfile` is
// unset; the choice can change later in Settings → General.
import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { isUiProfileId, type UiProfileId } from '../../../../shared/ui-profiles'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
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
          aria-label={t('stk.profile.picker.title', 'How will you use STK Studio?')}
          value={choice}
          onValueChange={(value) => {
            if (isUiProfileId(value)) {
              setChoice(value)
            }
          }}
        >
          {options.map((option) => (
            <div
              key={option.id}
              className={cn(
                'min-w-0 rounded-md border border-border',
                choice === option.id && 'bg-accent/50 text-accent-foreground'
              )}
            >
              <label className="flex cursor-pointer items-start gap-3 p-3">
                <RadioGroupItem value={option.id} className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button onClick={confirm}>{t('stk.profile.picker.continue', 'Continue')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
