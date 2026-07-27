import { ContractValidationError } from '@prisma-next/contract/contract-validation-error';
import { freezeNode } from '@prisma-next/framework-components/ir';
import {
  formatWireName,
  namingFromFlat,
  physicalNameOf,
  type SqlObjectNaming,
} from '@prisma-next/sql-schema-ir/naming';
import { SqlNode } from './sql-node';

/**
 * An index's element structure — exactly one of a column tuple or an opaque
 * expression, made unrepresentable-otherwise at the type level. No
 * discriminant is stored: the JSON shape stays flat (`columns` or
 * `expression`, never both), and the runtime xor guard in the constructor
 * remains as the backstop for JSON loads that bypass this input type.
 */
export type IndexElements =
  | {
      /** Column-tuple elements. */
      readonly columns: readonly string[];
      readonly expression?: never;
    }
  | {
      readonly columns?: never;
      /**
       * Opaque SQL: the entire element list between the parens of CREATE
       * INDEX — one string, never parsed.
       */
      readonly expression: string;
    };

/**
 * Construction input for {@link Index}. Internal seam (built by lowering and
 * FK materialization, not by end users), so every non-element key is
 * required and absence is stated explicitly as `undefined` — matching the
 * `SqlIndexIRInput` convention.
 */
export type IndexInput = IndexElements & {
  /**
   * Naming-mode union: `managed` derives the flat `name` as
   * `formatWireName(prefix, hash)`; `exact` adopts `name` verbatim (PSL
   * `map:`). A mismatched name/prefix pair is unconstructable from this
   * input; the flat JSON load boundary validates via
   * {@link indexInputFromSerialized}.
   */
  readonly naming: SqlObjectNaming;
  /** Opaque SQL: partial-index predicate (WHERE body, without the keyword). */
  readonly where: string | undefined;
  /** Rendered as CREATE UNIQUE INDEX. */
  readonly unique: boolean;
  readonly type: string | undefined;
  readonly options: Record<string, unknown> | undefined;
};

/**
 * The flat serialized index shape (`contract.json`): full `name`, optional
 * `prefix` whose presence marks managed mode. Converted to {@link IndexInput}
 * at the load boundary by {@link indexInputFromSerialized}.
 */
export type SerializedIndex = IndexElements & {
  readonly name: string;
  readonly prefix?: string;
  readonly where?: string;
  readonly unique: boolean;
  readonly type?: string;
  readonly options?: Record<string, unknown>;
};

/**
 * Converts flat serialized data into the union-shaped constructor input —
 * the one boundary where a declared prefix can still disagree with the
 * name, so the pair is validated here.
 */
export function indexInputFromSerialized(flat: SerializedIndex): IndexInput {
  if (flat.name === undefined || flat.name.length === 0) {
    throw new ContractValidationError(
      'Index: every index carries a full physical name; an expression index must be explicitly named (a default name cannot be derived from an expression).',
      'storage',
    );
  }
  const naming = namingFromFlat(flat.name, flat.prefix);
  if (naming === undefined) {
    throw new ContractValidationError(
      `Index "${flat.name}": prefix "${flat.prefix}" does not match the wire name (expected "${formatWireName(flat.prefix ?? '', '<8hex>')}").`,
      'storage',
    );
  }
  const carried = {
    naming,
    where: flat.where,
    unique: flat.unique,
    type: flat.type,
    options: flat.options,
  };
  return flat.expression !== undefined
    ? { ...carried, expression: flat.expression }
    : { ...carried, columns: flat.columns ?? [] };
}

/**
 * SQL Contract IR node for a table-level secondary index, name-identified:
 * `name` is the full physical name; a present `prefix` marks the index as
 * managed (`name` is `formatWireName(prefix, <8hex>)`), an absent `prefix`
 * marks it exact (the name is adopted verbatim).
 *
 * `expression`, `where`, and `unique` are genuine SQL-family attributes —
 * functional and partial indexes are standard SQL supported natively by
 * Postgres and SQLite alike, and the family IR must be able to represent
 * anything any SQL target can introspect. A target declining to AUTHOR them
 * (SQLite's rejection at namespace construction) is a capability decision,
 * not evidence of target-specificity.
 *
 * Note that this class shadows the global TypeScript `Index` lib type
 * at the family-shared name; consumer files that need both should
 * alias one (e.g.
 * `import { Index as SqlIndexNode } from '@prisma-next/sql-contract/types'`).
 */
export class Index extends SqlNode {
  readonly name: string;
  readonly unique: boolean;
  /** Derived from the managed naming arm — presence is the naming-mode discriminator in the flat JSON. */
  declare readonly prefix?: string;
  declare readonly columns?: readonly string[];
  declare readonly expression?: string;
  declare readonly where?: string;
  declare readonly type?: string;
  declare readonly options?: Record<string, unknown>;

  constructor(input: IndexInput) {
    super();
    const name = physicalNameOf(input.naming);
    if (name.length === 0) {
      throw new ContractValidationError(
        'Index: every index carries a full physical name; an expression index must be explicitly named (a default name cannot be derived from an expression).',
        'storage',
      );
    }
    if ((input.columns === undefined) === (input.expression === undefined)) {
      throw new ContractValidationError(
        `Index "${name}": exactly one of columns or expression must be set.`,
        'storage',
      );
    }
    this.name = name;
    this.unique = input.unique;
    if (input.naming.kind === 'managed') this.prefix = input.naming.prefix;
    if (input.columns !== undefined) this.columns = input.columns;
    if (input.expression !== undefined) this.expression = input.expression;
    if (input.where !== undefined) this.where = input.where;
    if (input.type !== undefined) this.type = input.type;
    if (input.options !== undefined) this.options = input.options;
    freezeNode(this);
  }
}
