import { readUserConfig, resolveGating, userConfigPath } from '@internal/cli-telemetry';

/**
 * Why telemetry resolves the way it does, in the order the CLI's
 * `resolveTelemetryGate` evaluates: CI hard-disables first, then the env
 * opt-outs, then the stored `enableTelemetry`, then the opt-out default.
 */
export type TelemetryStatusReason =
  | 'ci'
  | 'env-opt-out'
  | 'stored-opt-out'
  | 'stored-opt-in'
  | 'default-on';

export interface TelemetryStatus {
  readonly enabled: boolean;
  readonly reason: TelemetryStatusReason;
  readonly configPath: string;
  readonly installationIdStored: boolean;
}

/**
 * Resolves the same gate the runtime uses (CI check + `resolveGating`) and
 * projects it into a user-facing status. Pure read: never mints, never
 * writes. The `installationId` value itself is never surfaced — only its
 * presence — so `status` discloses nothing identifying.
 */
export function resolveTelemetryStatus(inputs: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly inCI: boolean;
}): TelemetryStatus {
  const config = readUserConfig();
  const configPath = userConfigPath();
  const installationIdStored =
    typeof config.installationId === 'string' && config.installationId.length > 0;

  if (inputs.inCI) {
    return { enabled: false, reason: 'ci', configPath, installationIdStored };
  }

  const gating = resolveGating({ env: inputs.env, config });
  if (!gating.enabled) {
    const reason: TelemetryStatusReason =
      gating.reason === 'env-override' ? 'env-opt-out' : 'stored-opt-out';
    return { enabled: false, reason, configPath, installationIdStored };
  }

  const reason: TelemetryStatusReason =
    config.enableTelemetry === true ? 'stored-opt-in' : 'default-on';
  return { enabled: true, reason, configPath, installationIdStored };
}

const REASON_EXPLANATION: Record<TelemetryStatusReason, string> = {
  ci: 'CI environment detected — telemetry is hard-disabled.',
  'env-opt-out': 'an environment opt-out is set (DO_NOT_TRACK / PRISMA_NEXT_DISABLE_TELEMETRY).',
  'stored-opt-out': '"enableTelemetry": false is stored in your config.',
  'stored-opt-in': '"enableTelemetry": true is stored in your config.',
  'default-on': 'no explicit choice is stored, so the opt-out default applies.',
};

export function formatTelemetryStatusLines(status: TelemetryStatus): string[] {
  return [
    `Telemetry is ${status.enabled ? 'enabled' : 'disabled'}: ${REASON_EXPLANATION[status.reason]}`,
    `Config file: ${status.configPath}`,
    `Installation ID: ${status.installationIdStored ? 'stored' : 'not stored'}`,
  ];
}
