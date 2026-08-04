import type { ValueSetRef } from '@internal/contract/types';
import { freezeNode } from '@internal/framework-components/ir';
import { SqlNode } from './sql-node';

/**
 * Hydration / construction input shape for {@link CheckConstraint}.
 * Mirrors the on-disk storage JSON envelope so the serializer hydration
 * walker can hand a validated literal straight to `new`.
 */
export interface CheckConstraintInput {
  readonly name: string;
  readonly column: string;
  readonly valueSet: ValueSetRef;
}

/**
 * SQL Contract IR node for a table-level check constraint that restricts
 * a column to the permitted values of a value-set.
 *
 * The constraint is **structured** (names a column and a value-set
 * reference), not a raw SQL expression. Each target renders its own DDL
 * from the structured form, keeping the contract target-agnostic.
 *
 * Construction is idempotent: passing an existing `CheckConstraint`
 * instance as input produces a new instance with identical fields.
 * The constructor does not use `instanceof` for input discrimination —
 * it reads plain named properties, which is sufficient since
 * `CheckConstraintInput` is a structural type.
 */
export class CheckConstraint extends SqlNode {
  readonly name: string;
  readonly column: string;
  readonly valueSet: ValueSetRef;

  constructor(input: CheckConstraintInput) {
    super();
    this.name = input.name;
    this.column = input.column;
    this.valueSet = input.valueSet;
    freezeNode(this);
  }
}
