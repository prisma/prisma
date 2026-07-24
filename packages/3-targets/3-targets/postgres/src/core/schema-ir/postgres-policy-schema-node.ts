import type { DiffableNode, SchemaNodeRef } from '@prisma-next/framework-components/control';
import { freezeNode } from '@prisma-next/framework-components/ir';
import { formatWireName, parseWireName } from '@prisma-next/sql-schema-ir/naming';
import { assertNode, defineNonEnumerable, SqlSchemaIRNode } from '@prisma-next/sql-schema-ir/types';
import { isArrayEqual } from '@prisma-next/utils/array-equal';
import { blindCast } from '@prisma-next/utils/casts';
import { InternalError } from '@prisma-next/utils/internal-error';
import type { RlsPolicyOperation } from '../postgres-rls-policy';
import { PostgresSchemaNodeKind } from './schema-node-kinds';

export interface PostgresPolicySchemaNodeInput {
  /** Full physical name. Managed: `<prefix>_<8hex>`. Exact: verbatim. */
  readonly name: string;
  /**
   * Wire-name prefix (the part before the `_<8hex>` suffix). Present ⇔
   * managed; absent ⇔ exact-named.
   */
  readonly prefix?: string;
  /** Name of the table this policy attaches to, by name within the same schema. */
  readonly tableName: string;
  /** Namespace coordinate (schema name). */
  readonly namespaceId: string;
  readonly operation: RlsPolicyOperation;
  /** Sorted role names rendered in `TO <roles>`. */
  readonly roles: readonly string[];
  /** USING predicate SQL string, if present. */
  readonly using?: string;
  /** WITH CHECK predicate SQL string, if present. */
  readonly withCheck?: string;
  /** `true` = `AS PERMISSIVE`, `false` = `AS RESTRICTIVE`. */
  readonly permissive: boolean;
  /**
   * This policy's table node, plus one entry per role it grants to — each
   * as the root-anchored chain the differ pairs siblings with. Stamped by
   * the derivation, which holds the parent (database/namespace) context.
   * Never compared by `isEqualTo`.
   */
  readonly dependsOn?: readonly SchemaNodeRef[];
}

/**
 * Schema-diff leaf node for a Postgres row-level security policy.
 *
 * This is a derived, transient node walked by the differ — it is NEVER serialized.
 * Built by project-from-contract and project-from-database from their respective
 * `PostgresRlsPolicy` contract entities / introspected rows.
 *
 * `id` is the full physical name. `isEqualTo` is mode-selected by the
 * receiver's `prefix`: a managed receiver (`prefix` present) compares ids
 * only — the wire name encodes a body hash, so name-equality is
 * body-equality and predicate bodies are never byte-compared (Postgres
 * reprints them). An exact receiver (`prefix` absent) compares content:
 * `operation`/`permissive` strict, `roles` sorted, and `using ?? ''` /
 * `withCheck ?? ''` verbatim byte-for-byte — reliable precisely when the
 * body text was captured from a Postgres reprint (contract infer).
 */
export class PostgresPolicySchemaNode extends SqlSchemaIRNode implements DiffableNode {
  override readonly nodeKind = PostgresSchemaNodeKind.policy;

  readonly name: string;
  declare readonly prefix?: string;
  readonly tableName: string;
  readonly namespaceId: string;
  readonly operation: RlsPolicyOperation;
  readonly roles: readonly string[];
  declare readonly using?: string;
  declare readonly withCheck?: string;
  readonly permissive: boolean;
  /** See {@link PostgresPolicySchemaNodeInput.dependsOn}. Non-enumerable so it stays out of JSON and structural equality, matching `SqlColumnIR.codecRef`. */
  declare readonly dependsOn?: readonly SchemaNodeRef[];

  constructor(input: PostgresPolicySchemaNodeInput) {
    super();
    if (input.prefix !== undefined) {
      const parsed = parseWireName(input.name);
      if (parsed === undefined || parsed.prefix !== input.prefix) {
        throw new InternalError(
          `PostgresPolicySchemaNode "${input.name}": prefix "${input.prefix}" does not match the wire name (expected "${formatWireName(input.prefix, '<8hex>')}").`,
        );
      }
    }
    this.name = input.name;
    if (input.prefix !== undefined) this.prefix = input.prefix;
    this.tableName = input.tableName;
    this.namespaceId = input.namespaceId;
    this.operation = input.operation;
    this.roles = Object.freeze([...input.roles]);
    if (input.using !== undefined) this.using = input.using;
    if (input.withCheck !== undefined) this.withCheck = input.withCheck;
    this.permissive = input.permissive;
    defineNonEnumerable(this, 'dependsOn', input.dependsOn);
    freezeNode(this);
  }

  get id(): string {
    return this.name;
  }

  children(): readonly DiffableNode[] {
    return [];
  }

  isEqualTo(other: DiffableNode): boolean {
    const node = blindCast<
      SqlSchemaIRNode,
      'every diff-tree node the differ pairs is a SqlSchemaIRNode; the guard rejects non-policy kinds'
    >(other);
    PostgresPolicySchemaNode.assert(node);
    if (this.prefix !== undefined) {
      return this.id === node.id;
    }
    return (
      this.operation === node.operation &&
      this.permissive === node.permissive &&
      isArrayEqual([...this.roles].sort(), [...node.roles].sort()) &&
      (this.using ?? '') === (node.using ?? '') &&
      (this.withCheck ?? '') === (node.withCheck ?? '')
    );
  }

  static is(node: SqlSchemaIRNode): node is PostgresPolicySchemaNode {
    return node.nodeKind === PostgresSchemaNodeKind.policy;
  }

  static assert(node: SqlSchemaIRNode | undefined): asserts node is PostgresPolicySchemaNode {
    assertNode(node, 'PostgresPolicySchemaNode', PostgresPolicySchemaNode.is);
  }
}
