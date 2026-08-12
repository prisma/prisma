import type { ControlPolicy } from '@internal/contract/types';
import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';
import {
  MongoCollectionOptions,
  type MongoCollectionOptionsInput,
} from './mongo-collection-options';
import { MongoIndex, type MongoIndexInput } from './mongo-index';
import { MongoValidator, type MongoValidatorInput } from './mongo-validator';

/**
 * Hydration / construction input shape for {@link MongoCollection}.
 * Mirrors the on-disk storage JSON envelope exactly (the value held at
 * `contract.storage.namespaces[<namespaceId>].entries.collection[<name>]`) so the family-base
 * serializer's hydration walker can hand an arktype-validated literal
 * straight to `new`. Nested IR-class fields may be supplied as either
 * plain data literals (typical for JSON-derived input) or
 * already-constructed class instances.
 */
export interface MongoCollectionInput {
  readonly indexes?: ReadonlyArray<MongoIndex | MongoIndexInput>;
  readonly validator?: MongoValidator | MongoValidatorInput;
  readonly options?: MongoCollectionOptions | MongoCollectionOptionsInput;
  readonly control?: ControlPolicy;
}

/**
 * Mongo Contract IR node for a single collection entry in a namespace's
 * `collections` map. Lifted from the pre-M2R2
 * `MongoStorageCollection` storage interface to a class extending
 * `IRNodeBase` per FR18.
 *
 * Concrete at the family layer (no target subclass). The spec's
 * `MongoTargetCollection extends MongoCollection` pattern remains
 * additive: a future Mongo target with target-specific extensions is
 * free to subclass without breaking the family-layer construction
 * sites.
 *
 * The unprefixed name `MongoCollection` is now the contract IR class.
 * Note that `@internal/mongo-orm` also exports a (different)
 * `MongoCollection<TContract, ModelName>` generic for the user-facing
 * ORM query builder; the two live in separate packages and are
 * resolved by import path. A source file that needs both should alias
 * one (e.g. `import { MongoCollection as MongoContractCollection }
 * from '@internal/mongo-contract'`).
 */
export class MongoCollection extends IRNodeBase {
  readonly kind = 'mongo-collection' as const;
  declare readonly indexes?: ReadonlyArray<MongoIndex>;
  declare readonly validator?: MongoValidator;
  declare readonly options?: MongoCollectionOptions;
  declare readonly control?: ControlPolicy;

  constructor(input: MongoCollectionInput = {}) {
    super();
    if (input.indexes !== undefined) {
      this.indexes = input.indexes.map((idx) =>
        idx instanceof MongoIndex ? idx : new MongoIndex(idx),
      );
    }
    if (input.validator !== undefined) {
      this.validator =
        input.validator instanceof MongoValidator
          ? input.validator
          : new MongoValidator(input.validator);
    }
    if (input.options !== undefined) {
      this.options =
        input.options instanceof MongoCollectionOptions
          ? input.options
          : new MongoCollectionOptions(input.options);
    }
    if (input.control !== undefined) this.control = input.control;
    freezeNode(this);
  }
}
