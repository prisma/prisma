import type { ColumnDefault } from '@internal/contract/types';

const NEXTVAL_PATTERN = /^nextval\s*\(/i;
const NOW_FUNCTION_PATTERN = /^(now\s*\(\s*\)|CURRENT_TIMESTAMP)$/i;
const CLOCK_TIMESTAMP_PATTERN = /^clock_timestamp\s*\(\s*\)$/i;
const TIMESTAMP_CAST_SUFFIX = /::timestamp(?:tz|\s+(?:with|without)\s+time\s+zone)?$/i;
const TEXT_CAST_SUFFIX = /::text$/i;
const NOW_LITERAL_PATTERN = /^'now'$/i;
const UUID_PATTERN = /^gen_random_uuid\s*\(\s*\)$/i;
const UUID_OSSP_PATTERN = /^uuid_generate_v4\s*\(\s*\)$/i;
const NULL_PATTERN = /^NULL(?:::.+)?$/i;
const TRUE_PATTERN = /^true$/i;
const FALSE_PATTERN = /^false$/i;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const JSON_CAST_SUFFIX = /::jsonb?$/i;
const STRING_LITERAL_PATTERN = /^'((?:[^']|'')*)'(?:::(?:"[^"]+"|[\w\s]+)(?:\(\d+\))?)?$/;

function canonicalizeTimestampDefault(expr: string): string | undefined {
  if (NOW_FUNCTION_PATTERN.test(expr)) return 'now()';
  if (CLOCK_TIMESTAMP_PATTERN.test(expr)) return 'clock_timestamp()';

  if (!TIMESTAMP_CAST_SUFFIX.test(expr)) return undefined;

  let inner = expr.replace(TIMESTAMP_CAST_SUFFIX, '').trim();
  if (inner.startsWith('(') && inner.endsWith(')')) {
    inner = inner.slice(1, -1).trim();
  }

  if (NOW_FUNCTION_PATTERN.test(inner)) return 'now()';
  if (CLOCK_TIMESTAMP_PATTERN.test(inner)) return 'clock_timestamp()';

  inner = inner.replace(TEXT_CAST_SUFFIX, '').trim();
  if (NOW_LITERAL_PATTERN.test(inner)) return 'now()';

  return undefined;
}

export function parseRawDefault(
  rawDefault: string,
  nativeType?: string,
): ColumnDefault | undefined {
  const trimmed = rawDefault.trim();
  const normalizedType = nativeType?.toLowerCase();

  if (NEXTVAL_PATTERN.test(trimmed)) {
    return { kind: 'function', expression: 'autoincrement()' };
  }

  const canonicalTimestamp = canonicalizeTimestampDefault(trimmed);
  if (canonicalTimestamp) {
    return { kind: 'function', expression: canonicalTimestamp };
  }

  if (UUID_PATTERN.test(trimmed) || UUID_OSSP_PATTERN.test(trimmed)) {
    return { kind: 'function', expression: 'gen_random_uuid()' };
  }

  if (NULL_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: null };
  }

  if (TRUE_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: true };
  }

  if (FALSE_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: false };
  }

  if (NUMERIC_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: Number(trimmed) };
  }

  const stringMatch = trimmed.match(STRING_LITERAL_PATTERN);
  if (stringMatch?.[1] !== undefined) {
    const unescaped = stringMatch[1].replace(/''/g, "'");
    if (normalizedType === 'json' || normalizedType === 'jsonb') {
      if (JSON_CAST_SUFFIX.test(trimmed)) {
        return { kind: 'function', expression: trimmed };
      }
      try {
        return { kind: 'literal', value: JSON.parse(unescaped) };
      } catch {
        // Fall through to the string form for malformed/non-JSON values.
      }
    }
    return { kind: 'literal', value: unescaped };
  }

  return { kind: 'function', expression: trimmed };
}
