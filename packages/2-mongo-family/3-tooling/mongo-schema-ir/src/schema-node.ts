import type { DiffableNode } from '@internal/framework-components/control';
import { IRNodeBase } from '@internal/framework-components/ir';
import type { MongoSchemaVisitor } from './visitor';

/**
 * Every concrete Mongo schema-IR node also implements the framework's
 * `DiffableNode` interface, so a node can be carried as the `expected`/
 * `actual` payload of a `SchemaDiffIssue`. Mongo's own diff (`diffMongoSchemas`)
 * still hand-rolls its comparisons and never calls `isEqualTo`/`children` —
 * this conformance exists so an issue can carry the real collection/index/
 * validator/options node it concerns, not a coordinate string.
 *
 * Follow-up: `isEqualTo`/`children` are dead weight on every Mongo node
 * (nothing calls them). The honest fix is splitting `DiffableNode` into a
 * narrower "issue payload" bound (just `id`) that this class implements,
 * separate from the full walkable `DiffableNode` (`id` + `isEqualTo` +
 * `children`) the generic differ actually pairs and recurses over.
 */
export abstract class MongoSchemaIRNode extends IRNodeBase implements DiffableNode {
  declare readonly kind: string;

  abstract readonly id: string;
  /** Per-node discriminant `DiffableNode` requires: collection / index / validator / collectionOptions / schema. */
  abstract readonly nodeKind: string;
  abstract accept<R>(visitor: MongoSchemaVisitor<R>): R;

  constructor() {
    super();
    Object.defineProperty(this, 'kind', {
      value: 'mongo-schema-ir',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  isEqualTo(other: DiffableNode): boolean {
    return this.id === other.id;
  }

  children(): readonly DiffableNode[] {
    return [];
  }
}
