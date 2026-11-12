// Snapshot → what the panels draw, in business language.
import { phaseProgress, type AidlcState } from '../domain/aidlc-state'
import { phaseLabel, stageLabel, STAGE_STATUS_LABEL } from '../domain/business-language'
import type { PhaseView } from '../protocol'

export function phaseViews(state: AidlcState | null): PhaseView[] {
  if (!state) {
    return []
  }
  return state.phases.map((phase) => {
    const progress = phaseProgress(phase)
    return {
      id: phase.id,
      label: phaseLabel(phase.id),
      ...progress,
      stages: phase.stages.map((stage) => ({
        name: stage.name,
        label: stageLabel(stage.name),
        status: stage.status,
        statusLabel: STAGE_STATUS_LABEL[stage.status] ?? stage.status
      }))
    }
  })
}
