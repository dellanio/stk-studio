// The plugin worker: files, git and network for the panels (panels have no network), plus the
// Caixa de Entrada polling behind the status bar badge.
import type { OrcaWorkerApi } from 'orca/worker'
import { registerDevHandlers } from './dev-handlers'
import { refreshInbox, registerInboxHandlers, schedulePoll, stopPolling } from './inbox-handlers'
import { registerStoriesHandlers } from './stories-handlers'

export default function activate(orca: OrcaWorkerApi): void {
  registerDevHandlers(orca)
  registerInboxHandlers(orca)
  registerStoriesHandlers(orca)
  orca.settings.onDidChange(() => schedulePoll(orca))
  void refreshInbox(orca, false).catch((error) =>
    orca.log(`inbox refresh failed: ${String(error)}`)
  )
  schedulePoll(orca)
}

export function deactivate(): void {
  stopPolling()
}
