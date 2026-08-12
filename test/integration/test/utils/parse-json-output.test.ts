import { describe, expect, it } from 'vitest';
import { parseJsonOutput } from './journey-test-helpers';

function result(stdout: string) {
  return { exitCode: 0, stdout, stderr: '' };
}

describe('parseJsonOutput', () => {
  it('unwraps the document from an engine result frame', () => {
    const frame = { kind: 'result', envelope: { ok: true, result: { ok: true, summary: 'done' } } };
    expect(parseJsonOutput(result(JSON.stringify(frame)))).toEqual({ ok: true, summary: 'done' });
  });

  it('unwraps the error from a failed engine result frame', () => {
    const frame = { kind: 'result', envelope: { ok: false, error: { code: 'CLI.UNEXPECTED' } } };
    expect(parseJsonOutput(result(JSON.stringify(frame)))).toEqual({ code: 'CLI.UNEXPECTED' });
  });

  it('preserves a null terminal document instead of returning the frame', () => {
    const frame = { kind: 'result', envelope: { ok: true, result: null } };
    expect(parseJsonOutput<null>(result(JSON.stringify(frame)))).toBeNull();
  });

  it('returns a commander-written document as-is', () => {
    const document = { ok: true, migrations: [] };
    expect(parseJsonOutput(result(JSON.stringify(document)))).toEqual(document);
  });
});
