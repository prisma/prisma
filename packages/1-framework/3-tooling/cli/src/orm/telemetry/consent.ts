import type { Presentations } from '@prisma/cli-engine';

/**
 * Shared by `telemetry enable|disable`: one confirmation line, echoed on
 * stdout, with the recorded decision as the json result.
 */
export function consentPresentations(line: string, json: unknown): Presentations {
  return {
    human: () => [{ kind: 'summary', tone: 'ok', text: line }],
    stdout: () => [line],
    json: () => json,
  };
}
