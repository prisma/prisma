import type { ReportedLiteralDefault } from '@internal/family-sql/control';
import { isStructuredError } from '@internal/utils/structured-error';
import {
  pgTimestamp,
  pgTimestampStoredText,
  pgTimestamptz,
  pgTimestamptzStoredText,
} from './data-types';

const STORED_TIMESTAMP_TEXT: ReadonlyMap<string, (text: string) => string> = new Map([
  [pgTimestamp.id, pgTimestampStoredText],
  [pgTimestamptz.id, pgTimestamptzStoredText],
]);

/**
 * The value a `timestamp` or `timestamptz` column holds for each body of a reported literal default, in its data type's stored spelling, with `null` for an SQL NULL element. A `Date` codec of these types reads only milliseconds, so its reading of a default can differ from what the column holds. `undefined` for any other data type, or a body the type does not read.
 */
export function heldTimestampDefault(
  dataTypeId: string,
  literal: ReportedLiteralDefault,
): readonly (string | null)[] | undefined {
  const storedText = STORED_TIMESTAMP_TEXT.get(dataTypeId);
  if (storedText === undefined) return undefined;
  const bodies = literal.kind === 'value' ? [literal.body] : literal.elements;
  const held: (string | null)[] = [];
  for (const body of bodies) {
    if (body === null) {
      held.push(null);
      continue;
    }
    if (typeof body !== 'string') return undefined;
    try {
      held.push(storedText(body));
    } catch (error) {
      if (isStructuredError(error)) return undefined;
      throw error;
    }
  }
  return held;
}
