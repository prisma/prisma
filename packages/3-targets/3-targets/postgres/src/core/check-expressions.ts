import { escapeLiteral, quoteIdentifier } from './sql-utils';

/**
 * One column's shape, as the contract builder knows it. `memberValues` is
 * present only for a domain enum authored through an `enumType()` handle —
 * a column bound to a native enum type carries its enforcement in the type
 * itself and arrives here with `memberValues` undefined.
 */
export interface PostgresCheckExpressionInput {
  readonly tableName: string;
  readonly columnName: string;
  readonly many: boolean;
  readonly memberValues: readonly string[] | undefined;
}

/**
 * A check the target wants written, before naming: the wire-name prefix and
 * the predicate body without its surrounding `CHECK (…)`. The contract
 * builder appends the content-hash suffix.
 */
export interface PostgresCheckExpressionCandidate {
  readonly prefix: string;
  readonly expression: string;
}

/**
 * Renders the checks a Postgres column needs, as opaque predicate text.
 *
 * A text-backed domain enum has no type-level enforcement, so membership is a
 * predicate: `IN` for a scalar, and `<@` containment for an array — an array
 * column cannot use `IN` at all (`operator does not exist: text[] = text`),
 * and containment additionally rejects NULL elements. Every list column also
 * gets an element-non-null check, which no Postgres column type can express.
 */
export function postgresRenderCheckExpressions(
  input: PostgresCheckExpressionInput,
): readonly PostgresCheckExpressionCandidate[] {
  const candidates: PostgresCheckExpressionCandidate[] = [];
  const column = quoteIdentifier(input.columnName);

  if (input.memberValues !== undefined) {
    const members = input.memberValues.map((value) => `'${escapeLiteral(value)}'`).join(', ');
    candidates.push({
      prefix: `${input.tableName}_${input.columnName}_check`,
      expression: input.many
        ? `${column} <@ ARRAY[${members}]::text[]`
        : `${column} IN (${members})`,
    });
  }

  if (input.many) {
    candidates.push({
      prefix: `${input.tableName}_${input.columnName}_elem_not_null`,
      expression: `array_position(${column}, NULL) IS NULL`,
    });
  }

  return candidates;
}
