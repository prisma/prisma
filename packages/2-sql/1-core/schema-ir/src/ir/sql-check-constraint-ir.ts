import type { DiffableNode } from '@internal/framework-components/control';
import { freezeNode } from '@internal/framework-components/ir';
import { blindCast } from '@internal/utils/casts';
import { RelationalSchemaNodeKind } from './schema-node-kinds';
import { assertNode, SqlSchemaIRNode } from './sql-schema-ir-node';

export interface SqlCheckConstraintIRInput {
  /** Constraint name as stored in the database catalog. */
  readonly name: string;
  /** Column the check restricts. */
  readonly column: string;
  /** Permitted values the column must be IN. */
  readonly permittedValues: readonly string[];
}

/**
 * Schema IR node for a table-level check constraint that restricts a
 * column to a set of permitted values (an enum-style `IN (...)` check).
 *
 * Carries the **resolved values** rather than a raw SQL predicate so
 * callers can compare value-sets without parsing SQL.
 *
 * Implements `DiffableNode` so a check constraint is directly a table's
 * diff-tree child: `id` is the constraint name. `isEqualTo` compares
 * `column` and the permitted-value set (order-insensitive — the database
 * does not guarantee `IN (...)` ordering).
 */
export class SqlCheckConstraintIR extends SqlSchemaIRNode implements DiffableNode {
  override readonly nodeKind = RelationalSchemaNodeKind.check;

  readonly name: string;
  readonly column: string;
  readonly permittedValues: readonly string[];

  constructor(input: SqlCheckConstraintIRInput) {
    super();
    this.name = input.name;
    this.column = input.column;
    this.permittedValues = Object.freeze([...input.permittedValues]);
    freezeNode(this);
  }

  get id(): string {
    return `check:${this.name}`;
  }

  children(): readonly DiffableNode[] {
    return [];
  }

  static is(node: SqlSchemaIRNode): node is SqlCheckConstraintIR {
    return node.nodeKind === RelationalSchemaNodeKind.check;
  }

  /**
   * Compares the permitted-value sets only (unordered), matching the
   * relational walk's `verifyCheckConstraints`: two checks pairing by name
   * compare their value sets — the `column` field is descriptive, not part
   * of the comparison, so a name-paired check with equal values verifies
   * regardless of which column carries it.
   */
  isEqualTo(other: DiffableNode): boolean {
    const node = blindCast<
      SqlSchemaIRNode,
      'every diff-tree node the differ pairs is a SqlSchemaIRNode'
    >(other);
    assertNode(node, 'SqlCheckConstraintIR', SqlCheckConstraintIR.is);
    const thisValues = new Set(this.permittedValues);
    const otherValues = new Set(node.permittedValues);
    if (thisValues.size !== otherValues.size) return false;
    return [...thisValues].every((v) => otherValues.has(v));
  }
}
