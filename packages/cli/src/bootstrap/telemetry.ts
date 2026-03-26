import type { LinkResult } from '../postgres/link/Link'
import { PosthogEventCapture } from '../utils/nps/capture'
import type { ProjectState } from './project-state'

const eventCapture = new PosthogEventCapture()

interface TelemetryContext {
  distinctId: string
  databaseId: string | undefined
  linkResult: LinkResult | null
  projectState: ProjectState
}

function baseProperties(ctx: TelemetryContext): Record<string, unknown> {
  return {
    'organization-id': ctx.linkResult?.workspaceId ?? null,
    'project-id': ctx.linkResult?.projectId ?? null,
    'environment-id': ctx.linkResult?.environmentId ?? null,
    database_id: ctx.databaseId ?? ctx.linkResult?.databaseId ?? null,
    is_existing_project: ctx.projectState.hasPackageJson,
  }
}

export async function emitFlowStarted(ctx: TelemetryContext): Promise<void> {
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_flow_started', baseProperties(ctx))
  } catch {
    // telemetry should never block the command
  }
}

export async function emitStepCompleted(ctx: TelemetryContext, stepName: string, durationMs: number): Promise<void> {
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_step_completed', {
      ...baseProperties(ctx),
      step_name: stepName,
      duration_ms: durationMs,
    })
  } catch {
    // telemetry should never block the command
  }
}

export async function emitStepSkipped(ctx: TelemetryContext, stepName: string): Promise<void> {
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_step_skipped', {
      ...baseProperties(ctx),
      step_name: stepName,
    })
  } catch {
    // telemetry should never block the command
  }
}

export async function emitStepFailed(ctx: TelemetryContext, stepName: string, error: string): Promise<void> {
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_step_failed', {
      ...baseProperties(ctx),
      step_name: stepName,
      error_message: error,
    })
  } catch {
    // telemetry should never block the command
  }
}

export async function emitFlowCompleted(
  ctx: TelemetryContext,
  stepsCompleted: string[],
  durationMs: number,
): Promise<void> {
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_flow_completed', {
      ...baseProperties(ctx),
      steps_completed: stepsCompleted,
      duration_ms: durationMs,
    })
  } catch {
    // telemetry should never block the command
  }
}
