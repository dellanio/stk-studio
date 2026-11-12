import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { usePluginPanelsStore } from '@/store/plugins/catalog/plugin-contribution-catalog'
import { UiProfileHome } from './UiProfileHome'

function setPoSettings(): void {
  useAppStore.setState((state) =>
    state.settings
      ? { settings: { ...state.settings, pluginSystemEnabled: true, uiProfile: 'po' } }
      : {}
  )
}

export const withInbox = defineFixture({
  width: 720,
  setup() {
    setPoSettings()
    usePluginPanelsStore.getState().setPlugins([
      {
        pluginKey: 'local.aidlc',
        consentFingerprint: 'fixture',
        name: 'STK AIDLC',
        version: '0.1.0',
        publisher: 'local',
        status: 'idle',
        needsReconsent: false,
        isDev: true,
        official: false,
        bundled: false,
        capabilities: [],
        panels: [{ id: 'inbox', title: 'Caixa de Entrada', tabKey: 'plugin:local.aidlc/inbox' }],
        commands: [],
        hasWorker: true,
        restarts: 0
      }
    ])
  },
  render: () => (
    <div className="flex h-80">
      <UiProfileHome />
    </div>
  )
})

export const pluginMissing = defineFixture({
  width: 720,
  setup() {
    setPoSettings()
    usePluginPanelsStore.getState().setPlugins([])
  },
  render: () => (
    <div className="flex h-80">
      <UiProfileHome />
    </div>
  )
})
