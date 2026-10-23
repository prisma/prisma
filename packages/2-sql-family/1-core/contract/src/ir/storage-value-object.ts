import type { ContractField } from '@internal/contract/types';
import { freezeNode } from '@internal/framework-components/ir';
import { SqlNode } from './sql-node';

/** Hydration / construction input shape for {@link StorageValueObject}; mirrors the stored JSON. */
export interface StorageValueObjectInput {
  readonly fields: Readonly<Record<string, ContractField>>;
}

/**
 * SQL Contract IR node for a value object in a namespace's `valueObject` map (`SqlNamespace.entries.valueObject`): the keys every row holds in a column that stores it (ADR 278). A domain field refers to it by its storage coordinate.
 *
 * The entry's name is not on the class: value objects are keyed by name in the parent namespace's `valueObject` map.
 */
export class StorageValueObject extends SqlNode {
  readonly fields: Readonly<Record<string, ContractField>>;

  constructor(input: StorageValueObjectInput) {
    super();
    this.fields = Object.freeze({ ...input.fields });
    freezeNode(this);
  }
}
