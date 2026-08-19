import { describe, expect, it } from 'vitest';
import type { EngineCommandResult } from './journey-test-helpers';
import { parseJsonOutput } from './journey-test-helpers';

function engineResult(overrides: Partial<EngineCommandResult>): EngineCommandResult {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    events: [],
    json: [],
    presented: undefined,
    ...overrides,
  };
}

const meta = { commandId: 'test', timestamp: '2026-01-01T00:00:00.000Z' };

describe('parseJsonOutput', () => {
  it('reads the presented document when the handler presented', () => {
    const run = engineResult({
      presented: {
        data: { ok: true, summary: 'done' },
        diagnostics: [],
        presentation: {},
      } as unknown as EngineCommandResult['presented'],
    });
    expect(parseJsonOutput(run)).toEqual({ ok: true, summary: 'done' });
  });

  it('unwraps the document from the terminal result frame when nothing was presented', () => {
    const run = engineResult({
      json: [
        {
          kind: 'result',
          envelope: {
            ok: true,
            commandId: 'test',
            exitCode: 0,
            result: { summary: 'done' },
            diagnostics: [],
            nextActions: [],
          },
          ...meta,
        },
      ],
    });
    expect(parseJsonOutput(run)).toEqual({ summary: 'done' });
  });

  it('unwraps the error from a failed terminal result frame', () => {
    const error = {
      code: 'CLI.UNEXPECTED' as const,
      severity: 'error' as const,
      summary: 'boom',
      nextActions: [],
    };
    const run = engineResult({
      exitCode: 2,
      json: [
        {
          kind: 'result',
          envelope: { ok: false, commandId: 'test', error, diagnostics: [], nextActions: [] },
          ...meta,
        },
      ],
    });
    expect(parseJsonOutput(run)).toEqual(error);
  });

  it('throws when the run produced neither a presented result nor a terminal frame', () => {
    expect(() => parseJsonOutput(engineResult({ exitCode: 1, stderr: 'boom' }))).toThrow(
      /no terminal result frame/,
    );
  });
});
