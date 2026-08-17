import type { CheckKind } from '@internal/sql-schema-ir/naming';
import { invariant } from '@internal/utils/assertions';
import { escapeLiteral, quoteIdentifier } from './sql-utils';

/**
 * What a rendered check enforces. The contract builder turns this into the
 * wire-name prefix's trailing segment, so the kind stays readable in the
 * physical constraint name. The vocabulary is the family's, so this names
 * `CheckKind` rather than restating its members.
 */
export type PostgresCheckKind = CheckKind;

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
  readonly elementNullable?: boolean;
  readonly memberValues: readonly string[] | undefined;
}

/**
 * A check the target wants written. The target contributes only what it
 * uniquely knows — which predicate, spelled how — while the family owns the
 * naming: it composes the prefix from the table, the column, and the kind,
 * caps it, and appends the content hash. Nothing here is a name.
 */
export interface PostgresCheckExpressionCandidate {
  readonly kind: PostgresCheckKind;
  /** The column this predicate constrains; the family names the check after it. */
  readonly columnName: string;
  /** Opaque SQL: the predicate body, without the surrounding `CHECK (…)`. */
  readonly expression: string;
}

/**
 * Renders the checks a Postgres column needs, as opaque predicate text.
 *
 * A text-backed domain enum has no type-level enforcement, so membership is a
 * predicate: `IN` for a scalar, and `<@` containment for an array — an array
 * column cannot use `IN` at all (`operator does not exist: text[] = text`).
 * Array membership strips NULL elements first, leaving element nullability to
 * the separate element-non-null check emitted for semantically strict lists.
 *
 * The array side casts the COLUMN to `text[]` rather than assuming its element
 * type already is: `<@` needs both operands in one type, so a `varchar[]` or
 * `char[]` column meeting a bare `text[]` literal raises the same
 * `operator does not exist` this project exists to eliminate. The scalar `IN`
 * form needs no cast — `varchar = text` resolves on its own.
 */
export function postgresRenderCheckExpressions(
  input: PostgresCheckExpressionInput,
): readonly PostgresCheckExpressionCandidate[] {
  const candidates: PostgresCheckExpressionCandidate[] = [];
  const column = quoteIdentifier(input.columnName);

  if (input.memberValues !== undefined) {
    invariant(
      input.memberValues.length > 0,
      `check for "${input.tableName}"."${input.columnName}": empty member set; both authoring surfaces reject a member-less enum before rendering`,
    );
    const members = input.memberValues.map((value) => `'${escapeLiteral(value)}'`).join(', ');
    candidates.push({
      kind: 'membership',
      columnName: input.columnName,
      expression: input.many
        ? `array_remove(${column}::text[], NULL) <@ ARRAY[${members}]::text[]`
        : `${column} IN (${members})`,
    });
  }

  if (input.many && input.elementNullable !== true) {
    candidates.push({
      kind: 'elementNotNull',
      columnName: input.columnName,
      expression: `array_position(${column}, NULL) IS NULL`,
    });
  }

  return candidates;
}
