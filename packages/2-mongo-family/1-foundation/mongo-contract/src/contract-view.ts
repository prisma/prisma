import {
  buildNamespacedEntities,
  buildSingleNamespaceView,
  type DefaultNamespaceEntries,
  type NamespacedEntities,
  type SingleNamespaceView,
} from '@internal/framework-components/ir';
import type { MongoContract } from './contract-types';

const MONGO_BUILTIN_KINDS = ['collection'] as const;
type MongoBuiltinKind = (typeof MONGO_BUILTIN_KINDS)[number];

type MongoEntries<TContract extends MongoContract> = DefaultNamespaceEntries<TContract['storage']>;

/**
 * The Mongo accessors: the built-in `collection` kind promoted to a top-level
 * accessor, pack-contributed kinds under `entries` (singular keys).
 */
export type MongoContractAccessors<TContract extends MongoContract> = SingleNamespaceView<
  MongoEntries<TContract>,
  MongoBuiltinKind
>;

/**
 * A Mongo contract view: the deserialized contract intersected with the by-name
 * accessors, so the value is substitutable for `Contract` (carries `storage`,
 * `domain`, …) while also exposing:
 *  - `view.collection.<name>` — the built-in kind, sole namespace unwrapped to
 *    the root (Mongo is single-namespace).
 *  - `view.entries.<kind>` — pack-contributed kinds (singular keys).
 *  - `view.namespace.<id>` — the namespace-keyed entity map (Mongo's sole
 *    namespace is `__unbound__`). This mirrors the runtime `db.enums` pattern:
 *    a single fixed `namespace` member, collision-proof.
 *
 * The factory (`MongoContractView.from` / `.fromJson`) lives in
 * `@internal/family-mongo/ir`, where the Mongo serializer is reachable; this
 * package owns the serializer-agnostic projection type and builder.
 */
export type MongoContractView<TContract extends MongoContract = MongoContract> = TContract &
  MongoContractAccessors<TContract> & {
    readonly namespace: NamespacedEntities<TContract['storage'], MongoBuiltinKind>;
  };

/**
 * Builds the Mongo view: unwraps the sole namespace's built-in `collection` kind
 * to the root, attaches the namespace-keyed `namespace` map, and layers both
 * over the deserialized contract so the result is a structural superset of the
 * contract.
 */
export function buildMongoContractView<TContract extends MongoContract>(
  contract: TContract,
): MongoContractView<TContract> {
  const rootAccessors = buildSingleNamespaceView<MongoContractAccessors<TContract>>(
    contract.storage,
    MONGO_BUILTIN_KINDS,
  );
  const namespace = buildNamespacedEntities<
    NamespacedEntities<TContract['storage'], MongoBuiltinKind>
  >(contract.storage, MONGO_BUILTIN_KINDS);
  return {
    ...contract,
    ...rootAccessors,
    namespace,
  };
}
