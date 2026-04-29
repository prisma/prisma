import fs from 'node:fs'
import path from 'node:path'

import { bold } from 'kleur/colors'

import type { LinkResult } from '../postgres/link/Link'
import { PosthogEventCapture, PUBLIC_POSTHOG_BOOTSTRAP_ACTIVATION_PROJECT_KEY } from '../utils/nps/capture'
import type { ProjectState } from './project-state'
import { detectPackageManager } from './template-scaffold'

function isTelemetryDisabled(): boolean {
  return Boolean(process.env.CHECKPOINT_DISABLE)
}

const eventCapture = new PosthogEventCapture(PUBLIC_POSTHOG_BOOTSTRAP_ACTIVATION_PROJECT_KEY)

export interface TelemetryContext {
  distinctId: string
  databaseId: string | undefined
  linkResult: LinkResult | null
  projectState: ProjectState
  isScriptedInvocation: boolean
  baseDir: string
}

function resolveLocalPrismaVersion(baseDir: string): string | null {
  try {
    const pkgPath = path.join(baseDir, 'node_modules', 'prisma', 'package.json')
    if (!fs.existsSync(pkgPath)) return null
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version ?? null
  } catch {
    return null
  }
}

function baseProperties(ctx: TelemetryContext): Record<string, unknown> {
  return {
    'organization-id': ctx.linkResult?.workspaceId ?? null,
    'project-id': ctx.linkResult?.projectId ?? null,
    'environment-id': ctx.linkResult?.environmentId ?? null,
    database_id: ctx.databaseId ?? ctx.linkResult?.databaseId ?? null,
    is_existing_project: ctx.projectState.hasPackageJson,
    is_scripted_invocation: ctx.isScriptedInvocation,
    package_manager: detectPackageManager(ctx.baseDir),
    resolved_local_prisma_version: resolveLocalPrismaVersion(ctx.baseDir),
    node_version: process.versions.node,
  }
}

export async function emitFlowStarted(ctx: TelemetryContext): Promise<void> {
  if (isTelemetryDisabled()) return
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_flow_started', baseProperties(ctx))
  } catch {
    // telemetry should never block the command
  }
}

export async function emitStepCompleted(ctx: TelemetryContext, stepName: string, durationMs: number): Promise<void> {
  if (isTelemetryDisabled()) return
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
  if (isTelemetryDisabled()) return
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
  if (isTelemetryDisabled()) return
  try {
    const errorCode = error.match(/^[A-Z]\d+:|Error code: ([A-Z]\d+)/)?.[1] ?? extractErrorClass(error)
    await eventCapture.capture(ctx.distinctId, 'activation:cli_step_failed', {
      ...baseProperties(ctx),
      step_name: stepName,
      error_code: errorCode,
    })
  } catch {
    // telemetry should never block the command
  }
}

export function extractErrorClass(msg: string): string {
  // More specific patterns first to avoid shadowing by broader ones.
  if (msg.includes('tsx') && msg.includes('ENOENT')) return 'TSX_MISSING'
  if (msg.includes('drift') || msg.includes('Drift detected')) return 'MIGRATION_DRIFT'
  if (msg.includes('authenticate') || msg.includes('credentials') || msg.includes('Invalid credentials'))
    return 'AUTH_INVALID'
  if (msg.includes('schema') && msg.includes('validation')) return 'SCHEMA_VALIDATION'
  const prismaCode = msg.match(/P\d{4}/)?.[0]
  if (prismaCode) return prismaCode
  if (msg.includes('ENOENT')) return 'ENOENT'
  if (msg.includes('EACCES') || msg.includes('permission denied')) return 'PERMISSION_DENIED'
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) return 'NETWORK_UNREACHABLE'
  if (msg.includes('datasource')) return 'DATASOURCE_CONFIG'
  return 'UNKNOWN'
}

/** Maps a classified error to a short, actionable recovery suggestion. */
export function recoveryHint(errorClass: string, pm: string): string | null {
  switch (errorClass) {
    case 'MIGRATION_DRIFT':
      return `Migration drift detected — run ${bold('prisma migrate reset')} to realign, then rerun bootstrap.`
    case 'TSX_MISSING':
      return `TypeScript seed runner not found. Install it with ${bold(`${pm} add -D tsx`)} then run ${bold('npx prisma db seed')}.`
    case 'AUTH_INVALID':
      return `Check your API key or re-authenticate via ${bold('npx prisma platform auth login')}.`
    case 'NETWORK_UNREACHABLE':
      return 'Check your network connection and try again.'
    case 'PERMISSION_DENIED':
      return 'Check file/directory permissions and try again.'
    case 'SCHEMA_VALIDATION':
      return `Fix the schema errors above, then rerun ${bold('prisma bootstrap')}.`
    case 'DATASOURCE_CONFIG':
      return `Check your prisma.config.ts datasource configuration.`
    default:
      return null
  }
}

export async function emitFlowFailed(
  ctx: TelemetryContext,
  failedStep: string,
  errorClass: string,
  stderrExcerpt: string,
  stepsCompleted: string[],
  durationMs: number,
): Promise<void> {
  if (isTelemetryDisabled()) return
  try {
    await eventCapture.capture(ctx.distinctId, 'activation:cli_flow_failed', {
      ...baseProperties(ctx),
      failed_step: failedStep,
      error_class: errorClass,
      stderr_excerpt: stderrExcerpt.slice(0, 500),
      steps_completed: stepsCompleted,
      duration_ms: durationMs,
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
  if (isTelemetryDisabled()) return
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
