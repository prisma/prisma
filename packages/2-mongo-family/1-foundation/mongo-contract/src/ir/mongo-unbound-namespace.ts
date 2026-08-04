import { freezeNode, NamespaceBase, UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { MongoNamespaceEntries } from './mongo-storage';

export class MongoUnboundNamespace extends NamespaceBase {
  static readonly instance: MongoUnboundNamespace = new MongoUnboundNamespace();

  readonly id = UNBOUND_NAMESPACE_ID;
  readonly entries: MongoNamespaceEntries = Object.freeze({
    collection: Object.freeze({}),
  });
  declare readonly kind: string;

  private constructor() {
    super();
    Object.defineProperty(this, 'kind', {
      value: 'mongo-namespace',
      writable: false,
      enumerable: false,
      configurable: true,
    });
    freezeNode(this);
  }
}
