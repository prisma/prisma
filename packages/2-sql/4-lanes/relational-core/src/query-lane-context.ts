import type { Contract } from '@prisma-next/contract/types';
import type { CodecDescriptor, CodecRef } from '@prisma-next/framework-components/codec';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import type { SqlOperationRegistry } from '@prisma-next/sql-operations';
import type { ContractCodecRegistry } from './ast/codec-types';

/**
 * Codec-id-keyed accessor for descriptor metadata. The unified read API for codec-id-keyed metadata (`traits`, `targetTypes`) — non-branching for parameterized vs. non-parameterized codecs. Every codec ships natively as a `CodecDescriptor` through the unified `codecs:` contributor slot (see ADR 208).
 */
export interface CodecDescriptorRegistry {
  /**
   * Descriptors carry distinct param shapes per codec id; the registry is heterogeneous and the consumer narrows per codec.
   */
  descriptorFor(codecId: string): CodecDescriptor<unknown> | undefined;
  /**
   * Derive the canonical {@link CodecRef} for a contract `(table, column)`. The builder side calls this at AST construction time to stamp `codec` onto every column-bound `ParamRef` / `ProjectionItem`; the runtime side uses the result as the cache key into the content-keyed codec resolver.
   *
   * Resolution rules over `storage.namespaces[namespaceId].tables[table].columns[column]`:
   *
   * - `typeRef` column → emit `{codecId, typeParams}` from `storage.types[typeRef]` (multiple columns sharing the typeRef produce the same ref → same memoised codec).
   * - inline `typeParams` column → emit `{codecId, typeParams}` from the column itself.
   * - non-parameterized column → emit `{codecId}` with `typeParams` undefined (keys as `${codecId}:undefined` → one shared codec).
   *
   * The `namespaceId` coordinate leads and is always supplied — the table is resolved strictly within that namespace, so two same-bare-named tables in different namespaces resolve to their own per-namespace columns/codecs without colliding.
   *
   * Returns `undefined` when the registry was built without contract storage (package-scoped registries used purely as descriptor lookups), when the table or column is unknown in the namespace, or when the column declares a `typeRef` that the storage doesn't define.
   */
  codecRefForColumn(namespaceId: string, table: string, column: string): CodecRef | undefined;
  /**
   * All registered descriptors. Used by `validateCodecRegistryCompleteness` and other startup-time consumers that enumerate descriptors.
   */
  values(): IterableIterator<CodecDescriptor<unknown>>;
  /**
   * Descriptors indexed by `targetTypes[i]` (each scalar type the codec advertises). Multiple descriptors may map to the same scalar type; ordering reflects registration order.
   */
  byTargetType(targetType: string): readonly CodecDescriptor<unknown>[];
}

/**
 * Registry of initialized type helpers from storage.types. Each key is a type name from storage.types, and the value is the resolved codec materialized once for that named instance via `descriptor.factory(typeParams)(ctx)` (or the raw `StorageTypeInstance` metadata for codec ids whose descriptor isn't registered).
 */
export type TypeHelperRegistry = Record<string, unknown>;

export type MutationDefaultsOp = 'create' | 'update';

export type AppliedMutationDefault = {
  readonly column: string;
  readonly value: unknown;
};

export type MutationDefaultsOptions = {
  readonly op: MutationDefaultsOp;
  readonly table: string;
  /**
   * Namespace of the target table. Execution-default refs are namespace-scoped,
   * so only defaults declared for `(namespace, table)` are applied — this is what
   * disambiguates same-named tables across namespaces. Required so the coordinate
   * is always part of the match; a missing namespace is a caller bug, not a
   * silent degrade to table-name-only matching.
   */
  readonly namespace: string;
  readonly values: Record<string, unknown>;
  /**
   * Per-ORM-operation cache for generators that declare `stability: 'query'`. The caller passes the same `Map` across every `applyMutationDefaults` invocation in one bulk operation; the framework keys by `generatorId` so the same value is reused across all rows and columns. Generators with `stability: 'row'` use a fresh per-call cache the framework manages internally; generators with `stability: 'field'` skip caching
   * entirely. Omit to make every call independent (degrades `'query'` to per-call behavior).
   */
  readonly defaultValueCache?: Map<string, unknown>;
};

/**
 * Minimal context interface for SQL query lanes.
 *
 * Lanes only need contract, operations, and codecs to build typed ASTs and attach operation builders. This interface explicitly excludes runtime concerns like adapters, connection management, and transaction state.
 */
export interface ExecutionContext<TContract extends Contract<SqlStorage> = Contract<SqlStorage>> {
  readonly contract: TContract;
  /**
   * Contract-bound codec registry built once at context-construction time by walking the contract's columns and resolving each through its descriptor's factory. Runtime dispatch (`encodeParam` / `decodeRow`) resolves codecs via `forCodecRef(ref)` — the single dispatch shape for AST-bound codec resolution.
   */
  readonly contractCodecs: ContractCodecRegistry;
  /**
   * Codec-id-keyed descriptor map. Single source of truth for codec-id-keyed metadata (`traits`, `targetTypes`) — every codec, parameterized or not, resolves through this map without branching.
   */
  readonly codecDescriptors: CodecDescriptorRegistry;
  readonly queryOperations: SqlOperationRegistry;
  /**
   * Type helper registry for parameterized types. Schema builders expose these helpers via schema.types.
   */
  readonly types: TypeHelperRegistry;
  /**
   * Applies execution-time mutation defaults for the given table. Returns the applied defaults (caller-provided values always win).
   */
  applyMutationDefaults(options: MutationDefaultsOptions): ReadonlyArray<AppliedMutationDefault>;
}
