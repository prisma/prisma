import { ContractValidationError } from '@prisma-next/contract/contract-validation-error';
import { freezeNode } from '@prisma-next/framework-components/ir';
import { SqlNode } from '@prisma-next/sql-contract/types';
import {
  formatWireName,
  namingFromFlat,
  physicalNameOf,
  type SqlObjectNaming,
} from '@prisma-next/sql-schema-ir/naming';

export type RlsPolicyOperation = 'select' | 'insert' | 'update' | 'delete' | 'all';

/**
 * The machine-rendered flat spelling of an input type: keys whose value
 * admits `undefined` become optional (and still accept explicit
 * `undefined`), everything else is carried unchanged — the
 * `required-key-undefined-fields.mdc` carve-out for rendered literals,
 * derived instead of hand-written so the field list has one home.
 */
type FlatSpelling<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

/**
 * The optional-key policy shape accepted by the migration authoring API
 * (`Migration#createRlsPolicy`) and emitted by the migration renderer.
 * Machine-rendered literals omit absent keys (`prefix` for an exact
 * policy, `withCheck` for a SELECT policy); derived from
 * {@link PostgresRlsPolicyInput}, so a new field appears here without a
 * second hand-written list — and the required-key `| undefined` convention
 * on the constructor input makes an omitted copy in
 * {@link rlsPolicyInputFromFlat} a compile error.
 */
export type PostgresRlsPolicyMigrationInput = FlatSpelling<
  Omit<PostgresRlsPolicyInput, 'naming'> & {
    /** Full physical name. */
    readonly name: string;
    /** Present ⇔ managed (the name is `<prefix>_<8hex>`); absent ⇔ exact-named. */
    readonly prefix: string | undefined;
  }
>;

export interface PostgresRlsPolicyInput {
  /**
   * Naming-mode union: `managed` derives the flat `name` as
   * `formatWireName(prefix, hash)`; `exact` adopts `name` verbatim.
   * Invariant statement: {@link SqlObjectNaming}. Flat data (contract JSON,
   * the migration API's literal) converts through
   * {@link rlsPolicyInputFromFlat}, which validates the pair.
   */
  readonly naming: SqlObjectNaming;
  /** Name of the table this policy attaches to, by name within the same schema. */
  readonly tableName: string;
  /** Namespace coordinate (schema name). Policies are schema-scoped. */
  readonly namespaceId: string;
  readonly operation: RlsPolicyOperation;
  /** Sorted role names rendered in `TO <roles>`. Plain strings for now. */
  readonly roles: readonly string[];
  /** USING predicate SQL string, if present. */
  readonly using: string | undefined;
  /** WITH CHECK predicate SQL string, if present. */
  readonly withCheck: string | undefined;
  /** `true` = `AS PERMISSIVE`, `false` = `AS RESTRICTIVE`. */
  readonly permissive: boolean;
}

/**
 * Postgres contract-IR class for a row-level security policy (`CREATE POLICY … ON …`).
 *
 * This is an authored, serialized Contract-IR entity — it is registered as an entity
 * kind, extends `SqlNode`, and is stored in `contract.json`. It is NOT a DiffableNode;
 * the schema-diff tree uses `PostgresPolicySchemaNode` for that role.
 *
 * Target-only concept — no SQL-family abstract. Extends `SqlNode` directly.
 * Frozen at construction via `freezeNode(this)`. The `kind: 'policy'`
 * discriminant is enumerable (overrides SqlNode's non-enumerable `'sql'`) so it
 * survives JSON serialization and enables dispatch. The literal matches the
 * entries key (one-string rule: node.kind === entries key === entity kind).
 */
export class PostgresRlsPolicy extends SqlNode {
  override readonly kind = 'policy' as const;
  readonly name: string;
  declare readonly prefix?: string;
  readonly tableName: string;
  readonly namespaceId: string;
  readonly operation: RlsPolicyOperation;
  readonly roles: readonly string[];
  declare readonly using?: string;
  declare readonly withCheck?: string;
  readonly permissive: boolean;

  constructor(input: PostgresRlsPolicyInput) {
    super();
    this.name = physicalNameOf(input.naming);
    if (input.naming.kind === 'managed') this.prefix = input.naming.prefix;
    this.tableName = input.tableName;
    this.namespaceId = input.namespaceId;
    this.operation = input.operation;
    this.roles = Object.freeze([...input.roles]);
    if (input.using !== undefined) this.using = input.using;
    if (input.withCheck !== undefined) this.withCheck = input.withCheck;
    this.permissive = input.permissive;
    freezeNode(this);
  }
}

/**
 * Converts the flat policy shape (contract JSON via the entity-kind
 * descriptor, the migration API's rendered literal, node/entity rebuilds)
 * into the union-shaped constructor input — the boundary where a declared
 * prefix can still disagree with the name, so the pair is validated here.
 * The derived flat keys accept both omission and explicit `undefined`.
 */
export function rlsPolicyInputFromFlat(
  flat: PostgresRlsPolicyMigrationInput,
): PostgresRlsPolicyInput {
  const naming = namingFromFlat(flat.name, flat.prefix);
  if (naming === undefined) {
    throw new ContractValidationError(
      `Policy "${flat.name}": prefix "${flat.prefix}" does not match the wire name (expected "${formatWireName(flat.prefix ?? '', '<8hex>')}").`,
      'storage',
    );
  }
  return {
    naming,
    tableName: flat.tableName,
    namespaceId: flat.namespaceId,
    operation: flat.operation,
    roles: flat.roles,
    using: flat.using,
    withCheck: flat.withCheck,
    permissive: flat.permissive,
  };
}
