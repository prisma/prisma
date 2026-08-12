import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { type FormatOptions, format } from '../../src/exports/format';

describe('format indent option', () => {
  it('defaults to two spaces', () => {
    const out = format('model User {\nid Int\n}');
    expect(out).toEqual(['model User {', '  id Int', '}', ''].join('\n'));
  });

  it('honors a custom positive integer indent', () => {
    const out = format('model User {\nid Int\n}', { indent: 4 });
    expect(out).toEqual(['model User {', '    id Int', '}', ''].join('\n'));
  });

  it('honors the literal tab indent', () => {
    const out = format('model User {\nid Int\n}', { indent: 'tab' });
    expect(out).toEqual(['model User {', '\tid Int', '}', ''].join('\n'));
  });

  it('applies indent per nesting depth', () => {
    const out = format('namespace n {\nmodel M {\nid Int\n}\n}', { indent: 4 });
    expect(out).toEqual(
      ['namespace n {', '    model M {', '        id Int', '    }', '}', ''].join('\n'),
    );
  });

  it('rejects a zero indent with PSL.FORMAT_OPTION_INVALID', () => {
    let thrown: unknown;
    try {
      format('model User {\nid Int\n}', { indent: 0 });
    } catch (error) {
      thrown = error;
    }
    expect(isStructuredError(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      code: 'PSL.FORMAT_OPTION_INVALID',
      meta: { option: 'indent', received: '0' },
    });
  });

  it('rejects a negative indent', () => {
    expect(() => format('model User {\nid Int\n}', { indent: -2 })).toThrow();
  });

  it('rejects a non-integer indent', () => {
    expect(() => format('model User {\nid Int\n}', { indent: 2.5 })).toThrow();
  });

  it('rejects an unknown string indent', () => {
    const options: FormatOptions = JSON.parse('{"indent":"spaces"}');
    expect(() => format('model User {\nid Int\n}', options)).toThrow();
  });
});

describe('format newline option', () => {
  it('defaults to LF', () => {
    const out = format('model User {\nid Int\n}');
    expect(out).toEqual('model User {\n  id Int\n}\n');
  });

  it('honors CRLF', () => {
    const out = format('model User {\nid Int\n}', { newline: 'CRLF' });
    expect(out).toEqual('model User {\r\n  id Int\r\n}\r\n');
  });

  it('rejects an unknown newline value with PSL.FORMAT_OPTION_INVALID', () => {
    const options: FormatOptions = JSON.parse('{"newline":"CR"}');
    let thrown: unknown;
    try {
      format('model User {\nid Int\n}', options);
    } catch (error) {
      thrown = error;
    }
    expect(isStructuredError(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      code: 'PSL.FORMAT_OPTION_INVALID',
      meta: { option: 'newline', received: 'CR' },
    });
  });
});

describe('format refuse-on-diagnostics', () => {
  it('throws PSL.PARSE_FAILED on diagnostic-bearing input', () => {
    expect(() => format('model {\n}')).toThrow('Cannot format PSL with parse errors');
  });

  it('exposes the parser diagnostics on the thrown error', () => {
    let thrown: unknown;
    try {
      format('model {\n}');
    } catch (error) {
      thrown = error;
    }
    expect(isStructuredError(thrown)).toBe(true);
    if (!isStructuredError(thrown)) {
      throw new Error('expected a structured error');
    }
    expect(thrown.code).toBe('PSL.PARSE_FAILED');
    const diagnostics = thrown.meta?.['diagnostics'] as ReadonlyArray<{ message: string }>;
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.message).toBeTypeOf('string');
  });

  it('does not emit best-effort output for malformed input', () => {
    expect(() => format('model User {\nid Int @\n}')).toThrow(
      'Cannot format PSL with parse errors',
    );
  });
});
