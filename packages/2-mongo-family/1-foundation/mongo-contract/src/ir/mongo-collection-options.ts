import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';
import type { MongoJsonObject } from '../contract-types';
import {
  MongoChangeStreamPreAndPostImagesOptions,
  type MongoChangeStreamPreAndPostImagesOptionsInput,
} from './mongo-change-stream-pre-and-post-images-options';
import type {
  MongoClusteredCollectionOptions,
  MongoClusteredCollectionOptionsInput,
} from './mongo-clustered-collection-options';
import { MongoCollationOptions, type MongoCollationOptionsInput } from './mongo-collation-options';
import {
  MongoIndexOptionDefaults,
  type MongoIndexOptionDefaultsInput,
} from './mongo-index-option-defaults';
import {
  MongoTimeSeriesCollectionOptions,
  type MongoTimeSeriesCollectionOptionsInput,
} from './mongo-time-series-collection-options';

/**
 * Storage-shape sub-shape: only `name` is persisted on the storage
 * `clusteredIndex` field. The richer authoring vocabulary
 * (`MongoClusteredCollectionOptions.key`, `…unique`) is intentionally
 * not round-tripped through the on-disk JSON envelope — those fields
 * are application-side configuration that informs collection creation
 * but does not survive into the persisted collection options.
 */
export interface MongoStorageClusteredIndexShape {
  readonly name?: string;
}

/**
 * Storage-shape sub-shape: `capped` collections persist `size` (required)
 * and optionally `max` document count. The authoring DSL surface uses a
 * flat `capped: boolean` + separate `size` / `max` fields; builders
 * translate that authoring vocabulary into this nested storage form
 * before constructing {@link MongoCollectionOptions}.
 */
export interface MongoStorageCappedShape {
  readonly size: number;
  readonly max?: number;
}

/**
 * Hydration / construction input shape for {@link MongoCollectionOptions}.
 * Mirrors the on-disk storage JSON envelope exactly (nested `capped`,
 * `clusteredIndex`, …) so the family-base serializer's hydration walker
 * can hand an arktype-validated object literal straight to `new`.
 * Nested IR-class fields may be supplied as either plain data literals
 * (typical for JSON-derived input) or already-constructed class
 * instances (typical when re-wrapping during a partial walk).
 */
export interface MongoCollectionOptionsInput {
  readonly capped?: MongoStorageCappedShape;
  readonly storageEngine?: MongoJsonObject;
  readonly indexOptionDefaults?: MongoIndexOptionDefaults | MongoIndexOptionDefaultsInput;
  readonly collation?: MongoCollationOptions | MongoCollationOptionsInput;
  readonly timeseries?: MongoTimeSeriesCollectionOptions | MongoTimeSeriesCollectionOptionsInput;
  readonly clusteredIndex?: MongoStorageClusteredIndexShape;
  readonly expireAfterSeconds?: number;
  readonly changeStreamPreAndPostImages?:
    | MongoChangeStreamPreAndPostImagesOptions
    | MongoChangeStreamPreAndPostImagesOptionsInput;
}

/**
 * Authoring-side flat vocabulary accepted by the contract-ts builder
 * DSL (e.g. `capped: boolean` + separate `size` / `max` scalars). The
 * builder translates this surface into a {@link MongoCollectionOptionsInput}
 * before constructing {@link MongoCollectionOptions}. Kept as a
 * standalone type so authoring DSL ergonomics do not leak into the
 * storage IR construction contract.
 */
export interface MongoCollectionOptionsAuthoringInput {
  readonly capped?: boolean;
  readonly size?: number;
  readonly max?: number;
  readonly storageEngine?: MongoJsonObject;
  readonly indexOptionDefaults?: MongoIndexOptionDefaults | MongoIndexOptionDefaultsInput;
  readonly collation?: MongoCollationOptions | MongoCollationOptionsInput;
  readonly timeseries?: MongoTimeSeriesCollectionOptions | MongoTimeSeriesCollectionOptionsInput;
  readonly clusteredIndex?: MongoClusteredCollectionOptions | MongoClusteredCollectionOptionsInput;
  readonly expireAfterSeconds?: number;
  readonly changeStreamPreAndPostImages?:
    | MongoChangeStreamPreAndPostImagesOptions
    | MongoChangeStreamPreAndPostImagesOptionsInput;
}

/**
 * Mongo Contract IR node for collection-level creation options (the
 * second argument to `db.createCollection(name, options)`). Lifted from
 * the pre-M2R2 `MongoStorageCollectionOptions` storage interface to a
 * class extending `IRNodeBase` per FR18.
 *
 * Single concrete family-layer class (no target subclass). The
 * constructor accepts the storage JSON envelope shape ({@link
 * MongoCollectionOptionsInput}) so the family-base hydration walker
 * can pass arktype-validated objects directly to `new`. Authoring
 * vocabulary is translated to this shape upstream in the contract-ts
 * builder.
 *
 * Nested IR sub-shapes (collation, timeseries, …) are normalised to
 * their respective IR class instances inside the constructor so
 * downstream walks see a uniform AST regardless of whether the input
 * was a JSON literal or an already-constructed class.
 */
export class MongoCollectionOptions extends IRNodeBase {
  readonly kind = 'mongo-collection-options' as const;
  declare readonly capped?: MongoStorageCappedShape;
  declare readonly storageEngine?: MongoJsonObject;
  declare readonly indexOptionDefaults?: MongoIndexOptionDefaults;
  declare readonly collation?: MongoCollationOptions;
  declare readonly timeseries?: MongoTimeSeriesCollectionOptions;
  declare readonly clusteredIndex?: MongoStorageClusteredIndexShape;
  declare readonly expireAfterSeconds?: number;
  declare readonly changeStreamPreAndPostImages?: MongoChangeStreamPreAndPostImagesOptions;

  constructor(input: MongoCollectionOptionsInput = {}) {
    super();
    if (input.capped !== undefined) {
      this.capped = {
        size: input.capped.size,
        ...(input.capped.max != null && { max: input.capped.max }),
      };
    }
    if (input.storageEngine !== undefined) this.storageEngine = input.storageEngine;
    if (input.indexOptionDefaults !== undefined) {
      this.indexOptionDefaults =
        input.indexOptionDefaults instanceof MongoIndexOptionDefaults
          ? input.indexOptionDefaults
          : new MongoIndexOptionDefaults(input.indexOptionDefaults);
    }
    if (input.collation !== undefined) {
      this.collation =
        input.collation instanceof MongoCollationOptions
          ? input.collation
          : new MongoCollationOptions(input.collation);
    }
    if (input.timeseries !== undefined) {
      this.timeseries =
        input.timeseries instanceof MongoTimeSeriesCollectionOptions
          ? input.timeseries
          : new MongoTimeSeriesCollectionOptions(input.timeseries);
    }
    if (input.clusteredIndex !== undefined) {
      this.clusteredIndex =
        input.clusteredIndex.name !== undefined ? { name: input.clusteredIndex.name } : {};
    }
    if (input.expireAfterSeconds !== undefined) this.expireAfterSeconds = input.expireAfterSeconds;
    if (input.changeStreamPreAndPostImages !== undefined) {
      this.changeStreamPreAndPostImages =
        input.changeStreamPreAndPostImages instanceof MongoChangeStreamPreAndPostImagesOptions
          ? input.changeStreamPreAndPostImages
          : new MongoChangeStreamPreAndPostImagesOptions(input.changeStreamPreAndPostImages);
    }
    freezeNode(this);
  }
}
