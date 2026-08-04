import type { JsonValue } from '@internal/contract/types';

/**
 * Renders a codec-encoded value as a TypeScript literal (e.g. `'low'`, `1`, `true`), or `undefined`
 * when the value isn't literal-expressible (objects, arrays, null).
 *
 * Valid **only for identity codecs** whose `encodeJson` output equals their decoded output type
 * (text, int, float, bool). A non-identity codec (e.g. one that encodes to an int but decodes to a
 * string literal) must NOT use this: it has to `decodeJson` first, then render, in its own
 * `renderValueLiteral`.
 *
 * String values are fully escaped for a single-quoted `.d.ts` literal: backslash, single quote, and
 * every character a raw single-quoted TS literal cannot contain — newline, carriage return, and the
 * U+2028/U+2029 line/paragraph separators (which JS also treats as line terminators).
 */
export function renderTsLiteral(value: JsonValue): string | undefined {
  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return `'${escaped}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}
