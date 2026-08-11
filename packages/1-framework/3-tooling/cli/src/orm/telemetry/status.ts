import type { Presentations } from '@prisma/cli-engine';
import { defineCommand } from '@prisma/cli-engine';
import { ok } from '@prisma/cli-engine/protocol';
import {
  formatTelemetryStatusLines,
  resolveTelemetryStatus,
  type TelemetryStatus,
} from '../../commands/telemetry/status';
import { isCI } from '../../utils/is-ci';

function statusPresentations(status: TelemetryStatus): Presentations {
  const [summary, ...rest] = formatTelemetryStatusLines(status);
  return {
    human: () => [
      { kind: 'summary', tone: 'info', text: summary ?? '' },
      {
        kind: 'fields',
        rows: [
          { label: 'Config file', value: status.configPath },
          {
            label: 'Installation ID',
            value: status.installationIdStored ? 'stored' : 'not stored',
          },
        ],
      },
    ],
    stdout: () => [summary ?? '', ...rest],
    json: () => status,
  };
}

export const telemetryStatusCommand = defineCommand({
  help: {
    summary: 'Show whether anonymous CLI telemetry is enabled and why',
    description:
      'Reports whether telemetry is currently enabled or disabled and the reason\n' +
      '(default-on, stored opt-out, environment opt-out, or CI), the path to your\n' +
      'user-level config file, and whether an installation ID has been stored.\n' +
      'Read-only: never sends an event, never mints an ID, never writes anything.',
    examples: ['telemetry status', 'telemetry status --json'],
  },
  handler: async (_args, ctx) => {
    const status = resolveTelemetryStatus({ env: ctx.env, inCI: isCI() });
    return ok(ctx.present({ data: status }, statusPresentations(status)));
  },
});
