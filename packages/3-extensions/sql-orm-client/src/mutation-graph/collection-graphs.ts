import {
  type AnyExpression,
  ColumnRef,
  checkLimitOffset,
  type SelectAst,
} from '@internal/sql-relational-core/ast';
import { resolveRowIdentityColumns } from '../collection-contract';
import type { DescribeCollectionRowsOptions } from '../collection-dispatch';
import { ormError } from '../orm-errors';
import {
  countMutationWhere,
  deleteAst,
  groupRowsByColumnSignature,
  type InsertConflictSkip,
  insertAst,
  projectTableColumns,
  updateAssignments,
  updateAst,
  upsertAst,
} from '../query-plan-mutations';
import { collectionSelectAst, collectionSelectWithIncludesAst } from '../query-plan-select';
import { type CollectionState, emptyState } from '../types';
import { Delete } from './delete';
import type { NodeId } from './edge';
import { FilterData } from './filter-data';
import { Find } from './find';
import { Graph } from './graph';
import { Insert } from './insert';
import { InsertChunked } from './insert-chunked';
import { Update } from './update';

export function updateAllGraph(
  collection: DescribeCollectionRowsOptions,
  set: Readonly<Record<string, unknown>>,
): Graph {
  const { context, state } = collection;
  const graph = new Graph();
  if (Object.keys(set).length === 0) {
    graph.setResult(graph.add(new Find(selectRowsAst(collection, state)), { filter: [] }));
    return graph;
  }

  requireIdentityColumnsForIncludes(collection);
  const update = updateAst(context.contract, state.tables, set, whereOf(collection));
  const updated = graph.add(new Update(update), { filter: [] });
  graph.setResult(addWithIncludes(graph, collection, updated));
  return graph;
}

export function deleteAllGraph(collection: DescribeCollectionRowsOptions): Graph {
  const { context, state } = collection;
  const graph = new Graph();
  const del = new Delete(deleteAst(context.contract, state.tables, whereOf(collection)));
  if (state.includes.length === 0) {
    graph.setResult(graph.add(del, { filter: [] }));
    return graph;
  }

  graph.setResult(graph.add(new Find(selectRowsAst(collection, state)), { filter: [] }));
  graph.add(del, { filter: [] });
  return graph;
}

export function updateFirstGraph(
  collection: DescribeCollectionRowsOptions,
  set: Readonly<Record<string, unknown>>,
): Graph {
  const { context, state } = collection;
  const graph = new Graph();
  const nothingToSet = Object.keys(set).length === 0;
  if (!nothingToSet) {
    requireIdentityColumns(collection);
    requireIdentityColumnsForIncludes(collection);
  }
  const find = addFindOfFirstRow(
    graph,
    collection,
    nothingToSet ? selectRowsAst : selectIdentityAst,
  );
  if (find === undefined) {
    return graph;
  }
  if (nothingToSet) {
    graph.setResult(find);
    return graph;
  }

  const update = updateAst(context.contract, state.tables, set, undefined);
  const updated = graph.add(new Update(update), { filter: [sameRow(find, collection)] });
  graph.setResult(addWithIncludes(graph, collection, updated));
  return graph;
}

export function deleteFirstGraph(collection: DescribeCollectionRowsOptions): Graph {
  const { context, state } = collection;
  const withIncludes = state.includes.length > 0;
  const graph = new Graph();
  requireIdentityColumns(collection);
  const find = addFindOfFirstRow(
    graph,
    collection,
    withIncludes ? selectRowsAst : selectIdentityAst,
  );
  if (find === undefined) {
    return graph;
  }

  const del = deleteAst(context.contract, state.tables, undefined);
  const deleted = graph.add(new Delete(del), { filter: [sameRow(find, collection)] });
  graph.setResult(withIncludes ? find : deleted);
  return graph;
}

export function createGraph(
  collection: DescribeCollectionRowsOptions,
  rows: readonly Record<string, unknown>[],
  conflict: InsertConflictSkip | undefined,
): Graph {
  const { context, state } = collection;
  const graph = new Graph();
  if (rows.length === 0) {
    return graph;
  }
  requireIdentityColumnsForIncludes(collection);
  const { contract } = context;
  const groups =
    contract.capabilities?.['sql']?.['defaultInInsert'] === true
      ? [rows]
      : groupRowsByColumnSignature(rows);
  const asts = groups.map((group) => insertAst(contract, state.tables.root, group, conflict));
  const [only, ...others] = asts;
  const inserted =
    only !== undefined && others.length === 0
      ? graph.add(new Insert(only), { payload: [] })
      : graph.add(new InsertChunked(asts), {});
  graph.setResult(addWithIncludes(graph, collection, inserted));
  return graph;
}

export function upsertGraph(
  collection: DescribeCollectionRowsOptions,
  create: Readonly<Record<string, unknown>>,
  update: Readonly<Record<string, unknown>>,
  conflictColumns: readonly string[],
): Graph {
  const { context, state } = collection;
  const { root } = state.tables;
  const graph = new Graph();
  requireIdentityColumnsForIncludes(collection);
  const updateSet =
    Object.keys(update).length > 0
      ? updateAssignments(context.contract, root, update)
      : Object.fromEntries(
          conflictColumns.slice(0, 1).map((column) => [column, ColumnRef.of('excluded', column)]),
        );
  const upsert = upsertAst(context.contract, root, create, conflictColumns, updateSet);
  const upserted = graph.add(new Insert(upsert), { payload: [] });
  graph.setResult(addWithIncludes(graph, collection, upserted));
  return graph;
}

function addWithIncludes(
  graph: Graph,
  collection: DescribeCollectionRowsOptions,
  written: NodeId,
): NodeId {
  const { state } = collection;
  if (state.includes.length === 0) {
    return written;
  }
  const select = selectRowsAst(collection, {
    ...emptyState(state.tables),
    selectedFields: state.selectedFields,
    includes: state.includes,
  });
  return graph.add(new Find(select), { filter: [sameRow(written, collection)] });
}

function requireIdentityColumnsForIncludes(collection: DescribeCollectionRowsOptions): void {
  const { modelName, state } = collection;
  const { tableName } = state.tables.root.storage;
  if (state.includes.length > 0 && identityColumnsOf(collection).length === 0) {
    throw ormError(
      'ORM.ROW_IDENTITY_MISSING',
      `Cannot load includes for the mutation result on model "${modelName}": table "${tableName}" has no primary key or unique constraint to key the include read-back on.`,
      { meta: { model: modelName, table: tableName } },
    );
  }
}

function addFindOfFirstRow(
  graph: Graph,
  collection: DescribeCollectionRowsOptions,
  select: typeof selectIdentityAst,
): NodeId | undefined {
  const { state } = collection;
  checkLimitOffset('limit', state.limit);
  if (state.limit === 0) {
    return undefined;
  }
  return graph.add(new Find(select(collection, { ...state, limit: 1 })), { filter: [] });
}

function requireIdentityColumns(collection: DescribeCollectionRowsOptions): void {
  const { modelName, state } = collection;
  const { tableName } = state.tables.root.storage;
  if (identityColumnsOf(collection).length === 0) {
    throw ormError(
      'ORM.ROW_IDENTITY_MISSING',
      `update()/delete() on model "${modelName}" requires the table to have a primary key or unique constraint`,
      { meta: { model: modelName, table: tableName } },
    );
  }
}

function selectIdentityAst(
  collection: DescribeCollectionRowsOptions,
  state: CollectionState,
): SelectAst {
  return collectionSelectAst(collection.context.contract, collection.modelName, {
    ...state,
    includes: [],
    selectedFields: identityColumnsOf(collection),
  });
}

function selectRowsAst(
  collection: DescribeCollectionRowsOptions,
  state: CollectionState,
): SelectAst {
  const { context, modelName } = collection;
  if (state.includes.length === 0) {
    return collectionSelectAst(context.contract, modelName, state);
  }
  return collectionSelectWithIncludesAst(
    context.contract,
    context.aggregateDescriptors,
    modelName,
    state,
  );
}

function identityColumnsOf(collection: DescribeCollectionRowsOptions): readonly string[] {
  const { namespaceId, tableName } = collection.state.tables.root.storage;
  return resolveRowIdentityColumns(collection.context.contract, namespaceId, tableName);
}

function sameRow(find: NodeId, collection: DescribeCollectionRowsOptions): FilterData {
  const { context, state } = collection;
  const columns = projectTableColumns(
    context.contract,
    state.tables.root,
    identityColumnsOf(collection),
  );
  return new FilterData(
    find,
    columns.map((column) => [column, column]),
  );
}

function whereOf(collection: DescribeCollectionRowsOptions): AnyExpression | undefined {
  const { context, state } = collection;
  return countMutationWhere(context.contract, state.tables, state.filters, state.variantValue);
}
