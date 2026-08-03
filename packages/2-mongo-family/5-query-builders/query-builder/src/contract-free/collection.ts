import {
  CreateCollectionCommand,
  type CreateCollectionOptions,
  CreateIndexCommand,
  type CreateIndexOptions,
  type MongoIndexKey,
} from '@internal/mongo-query-ast/control';
import {
  AggregateCommand,
  FindOneAndUpdateCommand,
  InsertOneCommand,
  MongoAndExpr,
  type MongoFilterExpr,
  MongoLimitStage,
  MongoMatchStage,
  type MongoPipelineStage,
  MongoSortStage,
  type MongoUpdatePipelineStage,
} from '@internal/mongo-query-ast/execution';
import type { MongoValue } from '@internal/mongo-value';
import { InternalError } from '@internal/utils/internal-error';
import { createFieldAccessor, type FieldAccessor } from '../field-accessor';
import type { DocShape } from '../types';
import { resolveUpdaterResult, type UpdaterResult } from '../update-ops';

/**
 * Fold an array of filter expressions into a single `MongoFilterExpr`. Length-1
 * short-circuits to avoid a redundant `$and` wrapper; the call site never writes
 * `MongoAndExpr.of([...])` directly.
 */
function foldFilters(filters: ReadonlyArray<MongoFilterExpr>): MongoFilterExpr {
  const first = filters[0];
  if (first === undefined) {
    throw new InternalError('foldFilters: invariant violated — empty filter list');
  }
  return filters.length === 1 ? first : MongoAndExpr.of(filters);
}

/**
 * Fluent aggregate chain. Accumulates `$match` / `$sort` / `$limit` stages and
 * produces an `AggregateCommand` via `.build()`.
 *
 * Instances are immutable — each stage method returns a new chain.
 */
export class AggregateChain<Shape extends DocShape> {
  readonly #collection: string;
  readonly #stages: ReadonlyArray<MongoPipelineStage>;

  constructor(collection: string, stages: ReadonlyArray<MongoPipelineStage>) {
    this.#collection = collection;
    this.#stages = stages;
  }

  match(filterFn: (fields: FieldAccessor<Shape>) => MongoFilterExpr): AggregateChain<Shape> {
    const f = createFieldAccessor<Shape>();
    const filter = filterFn(f);
    return new AggregateChain<Shape>(this.#collection, [
      ...this.#stages,
      new MongoMatchStage(filter),
    ]);
  }

  sort(spec: Record<string, 1 | -1>): AggregateChain<Shape> {
    return new AggregateChain<Shape>(this.#collection, [...this.#stages, new MongoSortStage(spec)]);
  }

  limit(n: number): AggregateChain<Shape> {
    return new AggregateChain<Shape>(this.#collection, [...this.#stages, new MongoLimitStage(n)]);
  }

  build(): AggregateCommand {
    return new AggregateCommand(this.#collection, this.#stages);
  }
}

/**
 * Fluent find-and-modify chain. Holds an accumulated list of filter expressions
 * (AND-folded into the wire command's `filter` slot) and exposes
 * `.findOneAndUpdate(...)` as the only terminal.
 *
 * Multiple `.match()` calls AND-fold internally — `MongoAndExpr.of` never
 * appears at the call site.
 *
 * Instances are immutable — `.match()` returns a new `FilteredBuilder`.
 */
export class FilteredBuilder<Shape extends DocShape> {
  readonly #collection: string;
  readonly #filters: ReadonlyArray<MongoFilterExpr>;

  constructor(collection: string, filters: ReadonlyArray<MongoFilterExpr>) {
    if (filters.length === 0) {
      throw new InternalError('FilteredBuilder requires at least one filter');
    }
    this.#collection = collection;
    this.#filters = filters;
  }

  match(filterFn: (fields: FieldAccessor<Shape>) => MongoFilterExpr): FilteredBuilder<Shape> {
    const f = createFieldAccessor<Shape>();
    const filter = filterFn(f);
    return new FilteredBuilder<Shape>(this.#collection, [...this.#filters, filter]);
  }

  findOneAndUpdate(
    updaterFn: (fields: FieldAccessor<Shape>) => UpdaterResult,
    opts: { readonly upsert?: boolean; readonly returnDocument?: 'before' | 'after' } = {},
  ): FindOneAndUpdateCommand {
    const filter = foldFilters(this.#filters);
    const f = createFieldAccessor<Shape>();
    const items = updaterFn(f);
    const update = resolveUpdaterResult(items);
    return new FindOneAndUpdateCommand(
      this.#collection,
      filter,
      update,
      opts.upsert ?? false,
      undefined,
      opts.returnDocument ?? 'after',
    );
  }
}

/**
 * Contract-free fluent Mongo collection builder. Produces the canonical
 * `AggregateCommand` / `InsertOneCommand` / `FindOneAndUpdateCommand` command
 * nodes without any contract coupling — parameterised by an explicit `DocShape`
 * instead of a `MongoContract`.
 *
 * Mirrors SQL's `table(source, schema)` → `TableHandle` in spirit: a top-level
 * entry point that exposes fluent query chains from which call sites never write
 * `new MongoMatchStage(...)`, `MongoAndExpr.of([...])`, or `new AggregateCommand(...)`.
 *
 * ```ts
 * const markerLedger = collection<MarkerLedgerDocShape>('_prisma_migrations');
 *
 * // aggregate
 * markerLedger.aggregate().match(f => f._id.eq(space)).limit(1).build();
 *
 * // insertOne
 * markerLedger.insertOne({ _id: space, space, storageHash });
 *
 * // findOneAndUpdate (CAS)
 * markerLedger.match(f => f._id.eq(space)).match(f => f.storageHash.eq(expectedFrom))
 *   .findOneAndUpdate(f => [f.stage.set({ storageHash: newHash })], { upsert: false });
 * ```
 */
export interface CollectionBuilder<Shape extends DocShape> {
  aggregate(): AggregateChain<Shape>;
  insertOne(document: Record<string, MongoValue>): InsertOneCommand;
  match(filterFn: (fields: FieldAccessor<Shape>) => MongoFilterExpr): FilteredBuilder<Shape>;
  createCollection(options?: CreateCollectionOptions): CreateCollectionCommand;
  createIndex(keys: ReadonlyArray<MongoIndexKey>, options?: CreateIndexOptions): CreateIndexCommand;
}

class CollectionBuilderImpl<Shape extends DocShape> implements CollectionBuilder<Shape> {
  readonly #name: string;

  constructor(name: string) {
    this.#name = name;
  }

  aggregate(): AggregateChain<Shape> {
    return new AggregateChain<Shape>(this.#name, []);
  }

  insertOne(document: Record<string, MongoValue>): InsertOneCommand {
    return new InsertOneCommand(this.#name, document);
  }

  match(filterFn: (fields: FieldAccessor<Shape>) => MongoFilterExpr): FilteredBuilder<Shape> {
    const f = createFieldAccessor<Shape>();
    const filter = filterFn(f);
    return new FilteredBuilder<Shape>(this.#name, [filter]);
  }

  createCollection(options?: CreateCollectionOptions): CreateCollectionCommand {
    return new CreateCollectionCommand(this.#name, options);
  }

  createIndex(
    keys: ReadonlyArray<MongoIndexKey>,
    options?: CreateIndexOptions,
  ): CreateIndexCommand {
    return new CreateIndexCommand(this.#name, keys, options);
  }
}

/**
 * Declare a contract-free collection builder parameterised by a `DocShape`.
 * The collection name is bound once; field access reuses `createFieldAccessor`
 * so the shape is typed at every call site without a contract.
 *
 * @param name The MongoDB collection name (e.g. `'_prisma_migrations'`)
 */
export function collection<Shape extends DocShape>(name: string): CollectionBuilder<Shape> {
  return new CollectionBuilderImpl<Shape>(name);
}

export type { MongoUpdatePipelineStage };
