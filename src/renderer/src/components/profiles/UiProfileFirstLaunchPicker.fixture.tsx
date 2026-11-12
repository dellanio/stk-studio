import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { UiProfileFirstLaunchPicker } from './UiProfileFirstLaunchPicker'

export const firstRun = defineFixture({
  width: 720,
  setup() {
    useAppStore.setState((state) =>
      state.settings ? { settings: { ...state.settings, uiProfile: undefined } } : {}
    )
  },
  render: () => (
    <div className="h-[420px]">
      <UiProfileFirstLaunchPicker suppressed={false} />
    </div>
  )
})
