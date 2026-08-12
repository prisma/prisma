import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export interface MongoChangeStreamPreAndPostImagesOptionsInput {
  readonly enabled: boolean;
}

/**
 * Change-stream pre-and-post-images collection option. Lifted from a
 * `type =` data shape to an AST class extending `IRNodeBase` per
 * FR18. Single-field shape; the class exists for AST-pattern
 * consistency (every nested data shape inside `MongoCollectionOptions`
 * is an AST node so the verifier can walk uniformly).
 */
export class MongoChangeStreamPreAndPostImagesOptions extends IRNodeBase {
  readonly kind = 'mongo-change-stream-pre-and-post-images-options' as const;
  readonly enabled: boolean;

  constructor(options: MongoChangeStreamPreAndPostImagesOptionsInput) {
    super();
    this.enabled = options.enabled;
    freezeNode(this);
  }
}
