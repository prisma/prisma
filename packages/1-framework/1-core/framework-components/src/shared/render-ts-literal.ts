import type { JsonValue } from '@internal/contract/types';
import { tsStringLiteral } from '@internal/ts-render';

/**
 * Renders a codec-encoded value as a TypeScript literal (e.g. `"low"`, `1`, `true`), or `undefined`
 * when the value isn't literal-expressible (objects, arrays, null).
 *
 * Valid **only for identity codecs** whose `encodeJson` output equals their decoded output type
 * (text, int, float, bool). A non-identity codec (e.g. one that encodes to an int but decodes to a
 * string literal) must NOT use this: it has to `decodeJson` first, then render, in its own
 * `renderValueLiteral`.
 */
export function renderTsLiteral(value: JsonValue): string | undefined {
  if (typeof value === 'string') {
    return tsStringLiteral(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}
