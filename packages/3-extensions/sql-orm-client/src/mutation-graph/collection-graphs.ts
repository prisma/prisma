import {
  type AnyExpression,
  checkLimitOffset,
  type SelectAst,
} from '@internal/sql-relational-core/ast';
import { resolveRowIdentityColumns } from '../collection-contract';
import type { DescribeCollectionRowsOptions } from '../collection-dispatch';
import { ormError } from '../orm-errors';
import {
  countMutationWhere,
  deleteAst,
  projectTableColumns,
  updateAst,
} from '../query-plan-mutations';
import { collectionSelectAst, collectionSelectWithIncludesAst } from '../query-plan-select';
import type { CollectionState } from '../types';
import { Delete } from './delete';
import type { NodeId } from './edge';
import { FilterData } from './filter-data';
import { Find } from './find';
import { Graph } from './graph';
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

  const update = updateAst(context.contract, state.tables, set, whereOf(collection));
  graph.setResult(graph.add(new Update(update), { filter: [] }));
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
  graph.setResult(graph.add(new Update(update), { filter: [sameRow(find, collection)] }));
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
