import type { JsonValue } from '@internal/contract/types';
import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

/**
 * Hydration / construction input shape for {@link MongoValueSet}. Mirrors the on-disk storage JSON
 * envelope (the value held at `contract.storage.namespaces[<ns>].entries.valueSet[<Name>]`) so the
 * serializer hydration walker can hand a validated literal straight to `new`.
 */
export interface MongoValueSetInput {
  readonly kind: 'valueSet';
  /** Ordered permitted values, codec-encoded. Declaration order is preserved. */
  readonly values: readonly JsonValue[];
}

/**
 * Mongo Contract IR node for a value-set entry in a namespace's `valueSet` map
 * (`entries.valueSet`). Same shape as SQL's `StorageValueSet`: the ordered set of permitted
 * codec-encoded values for a field restriction, with no `codecId` (the field that references it
 * holds the codec). The `kind` is enumerable so the JSON envelope carries the discriminator and the
 * hydration walker can dispatch on it. Value-sets are keyed by name in the parent namespace's
 * `valueSet: Record<string, MongoValueSet>` map, so the entry name is not on the class.
 */
export class MongoValueSet extends IRNodeBase {
  readonly kind = 'valueSet' as const;
  readonly values: readonly JsonValue[];

  constructor(input: MongoValueSetInput) {
    super();
    this.values = Object.freeze([...input.values]);
    freezeNode(this);
  }
}
