import type {
  ExtractAggregateTypes,
  ExtractCodecTypes,
  ExtractQueryOperationTypes,
  ExtractStorageColumnInputTypes,
  ExtractStorageColumnTypes,
  StorageColumnMapAt,
  StorageTable,
} from '@internal/sql-contract/types';
import type { Expression, FieldProxy, Functions } from '../expression';
import type {
  DefaultScope,
  EmptyRow,
  JoinSource,
  QueryContext,
  RebindScope,
  Scope,
  StorageTableToScopeTable,
} from '../scope';
import type { NamespaceTable, TableProxyContract } from './db';
import type { DeleteQuery, InsertQuery, InsertValues, UpdateQuery } from './mutation-query';
import type { WithJoin, WithSelect } from './shared';

// Homomorphic mapped form: result is always `Record<string, unknown>` even when
// `C` is generic, so it satisfies `QueryContext['resolvedColumnOutputTypes']`.
type ResolvedColumnTypes<
  C extends TableProxyContract,
  NsId extends string,
  TableName extends string,
  ColMap = StorageColumnMapAt<ExtractStorageColumnTypes<C>, NsId, TableName>,
  ColumnKeys extends string = [ColMap] extends [never] ? never : keyof ColMap & string,
> = {
  readonly [K in ColumnKeys]: ColMap extends Record<K, unknown> ? ColMap[K] : never;
};

type ResolvedInsertValues<
  C extends TableProxyContract,
  NsId extends string,
  Table extends StorageTable,
  TableName extends string,
  CT extends Record<string, { readonly input: unknown }>,
> =
  StorageColumnMapAt<ExtractStorageColumnInputTypes<C>, NsId, TableName> extends infer ColMap
    ? [ColMap] extends [never]
      ? InsertValues<Table, CT>
      : { [K in keyof ColMap]?: ColMap[K] }
    : InsertValues<Table, CT>;

type ResolvedUpdateValues<
  C extends TableProxyContract,
  NsId extends string,
  Table extends StorageTable,
  TableName extends string,
  CT extends Record<string, { readonly input: unknown }>,
> = ResolvedInsertValues<C, NsId, Table, TableName, CT>;

type ResolvedUpdateExpressions<Table extends StorageTable> = {
  [K in keyof Table['columns']]?: Expression<{
    codecId: Table['columns'][K]['codecId'];
    nullable: boolean;
  }>;
};

export type ContractToQC<
  C extends TableProxyContract,
  NsId extends string = string,
  Name extends string = string,
> = {
  readonly codecTypes: ExtractCodecTypes<C>;
  readonly capabilities: C['capabilities'];
  readonly queryOperationTypes: ExtractQueryOperationTypes<C>;
  readonly resolvedColumnOutputTypes: ResolvedColumnTypes<C, NsId, Name>;
  readonly aggregateTypes: ExtractAggregateTypes<C>;
};

export interface TableProxy<
  C extends TableProxyContract,
  NsId extends string,
  Name extends string,
  Alias extends string = Name,
  AvailableScope extends Scope = DefaultScope<Name, NamespaceTable<C, NsId, Name>>,
  QC extends QueryContext = ContractToQC<C, NsId, Name>,
> extends JoinSource<StorageTableToScopeTable<NamespaceTable<C, NsId, Name>>, Alias>,
    WithSelect<QC, AvailableScope, EmptyRow>,
    WithJoin<QC, AvailableScope, C['capabilities']> {
  as<NewAlias extends string>(
    newAlias: NewAlias,
  ): TableProxy<C, NsId, Name, NewAlias, RebindScope<AvailableScope, Alias, NewAlias>, QC>;

  insert(
    rows: ReadonlyArray<
      ResolvedInsertValues<C, NsId, NamespaceTable<C, NsId, Name>, Name, QC['codecTypes']>
    >,
  ): InsertQuery<QC, AvailableScope, EmptyRow>;

  update(
    set: ResolvedUpdateValues<C, NsId, NamespaceTable<C, NsId, Name>, Name, QC['codecTypes']>,
  ): UpdateQuery<QC, AvailableScope, EmptyRow>;

  update(
    callback: (
      fields: FieldProxy<AvailableScope>,
      fns: Functions<QC>,
    ) => ResolvedUpdateExpressions<NamespaceTable<C, NsId, Name>>,
  ): UpdateQuery<QC, AvailableScope, EmptyRow>;

  delete(): DeleteQuery<QC, AvailableScope, EmptyRow>;
}
