import type { Contract } from '@internal/contract/types';
import {
  type AnnotationValue,
  AsyncIterableResult,
  type OperationKind,
} from '@internal/framework-components/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { SqlStatementStats } from '@internal/sql-relational-core/ast';
import { blindCast } from '@internal/utils/casts';
import { getColumnsReadOnTable } from '../collection-contract';
import { consumeCollectionRows, type DescribeCollectionRowsOptions } from '../collection-dispatch';
import { mapMutationRows, mutationReturningColumns } from '../collection-mutation-dispatch';
import { mapResultRows, stripHiddenMappedFields } from '../collection-runtime';
import { withMutationScope } from '../mutation-executor';
import { buildOrmQueryPlan, deriveParamsFromAst, mergeAnnotations } from '../query-plan-meta';
import { returningProjection } from '../query-plan-mutations';
import { queryPlanRows } from '../query-plan-rows';
import type { CollectionContext } from '../types';
import type { NodeId, StorageRow } from './edge';
import type { Graph } from './graph';
import type { Executed, Node, OutputsOf, Run, Slots, StatementAst } from './node';

type Annotations = ReadonlyMap<string, AnnotationValue<unknown, OperationKind>> | undefined;
type Context = CollectionContext<Contract<SqlStorage>>;
type Collected = readonly (readonly StorageRow[] | number)[];

interface Outcome<Row> {
  readonly rows: readonly Row[];
  readonly count: number;
}

export function queryGraph<Row>(
  graph: Graph,
  ctx: Context,
  annotations: Annotations,
  callerRows: DescribeCollectionRowsOptions,
): AsyncIterableResult<Row> {
  returnCallerColumns(graph, callerRows);
  const [only, ...others] = graph.nodes();
  if (only !== undefined && others.length === 0 && only[0] === graph.result) {
    const [id, node] = only;
    const run = runOn(ctx, annotations);
    const storageRows = () => rowStream(node.execute(inputsOf(graph, id, []), run));
    return shapeRows<Row>(graph, id, node, storageRows, ctx, annotations, callerRows);
  }
  const generator = async function* (): AsyncGenerator<Row, void, unknown> {
    const outcome = await runAllNodes<Row>(graph, ctx, annotations, callerRows);
    yield* outcome.rows;
  };
  return new AsyncIterableResult(generator());
}

export async function executeGraph(
  graph: Graph,
  ctx: Context,
  annotations: Annotations,
): Promise<SqlStatementStats> {
  const outcome = await runAllNodes(graph, ctx, annotations, undefined);
  return { affectedRows: outcome.count };
}

function returnCallerColumns(graph: Graph, callerRows: DescribeCollectionRowsOptions): void {
  const { context, namespaceId, modelName, state } = callerRows;
  const { root } = state.tables;
  const columns = returningProjection(
    context.contract,
    modelName,
    root,
    mutationReturningColumns(
      context.contract,
      namespaceId,
      modelName,
      root.storage.tableName,
      state.selectedFields,
      state.includes,
    ),
  );
  for (const [id, node] of graph.nodes()) {
    if (id === graph.result && node.rowsAre === 'written') {
      graph.replace(id, node.withReturning(columns));
    }
  }
}

function runAllNodes<Row>(
  graph: Graph,
  ctx: Context,
  annotations: Annotations,
  callerRows: DescribeCollectionRowsOptions | undefined,
): Promise<Outcome<Row>> {
  if (graph.nodes().length > 1) {
    return withMutationScope(ctx.runtime, (scope) =>
      runNodesInOrder<Row>(graph, { ...ctx, runtime: scope }, annotations, callerRows),
    );
  }
  return runNodesInOrder<Row>(graph, ctx, annotations, callerRows);
}

async function runNodesInOrder<Row>(
  graph: Graph,
  ctx: Context,
  annotations: Annotations,
  callerRows: DescribeCollectionRowsOptions | undefined,
): Promise<Outcome<Row>> {
  const run = runOn(ctx, annotations);
  const collected: (readonly StorageRow[] | number)[] = [];
  let rows: readonly Row[] = [];
  let count = 0;

  for (const [id, node] of graph.nodes()) {
    const executed = await node.execute(inputsOf(graph, id, collected), run);
    collected[id] = executed;
    if (id !== graph.result) {
      continue;
    }
    const storageRows = rowsOf(executed);
    count = typeof executed === 'number' ? executed : storageRows.length;
    if (callerRows !== undefined) {
      const stream = () => streamOf(storageRows);
      const shaped = shapeRows<Row>(graph, id, node, stream, ctx, annotations, callerRows);
      rows = await shaped.toArray();
    }
  }

  return { rows, count };
}

function inputsOf(graph: Graph, id: NodeId, collected: Collected): OutputsOf<Slots> {
  const outputs: Record<string, readonly (readonly unknown[])[] | null> = {};
  const slots = graph.inputsOf(id);
  for (const slot in slots) {
    const edges = slots[slot] ?? [];
    outputs[slot] =
      edges.length === 0
        ? null
        : edges.map((edge) => rowsOf(collected[edge.from]).map((row) => edge.output(row)));
  }
  return outputs;
}

function runOn(ctx: Context, annotations: Annotations): Run {
  const { contract } = ctx.context;
  const planOf = (ast: StatementAst) =>
    mergeAnnotations(
      buildOrmQueryPlan<StorageRow>(contract, ast, deriveParamsFromAst(ast).params),
      annotations,
    );
  return {
    query: (ast) => queryPlanRows(ctx.runtime, planOf(ast)),
    execute: async (ast) => (await ctx.runtime.execute(planOf(ast))).affectedRows,
  };
}

function shapeRows<Row>(
  graph: Graph,
  id: NodeId,
  node: Node,
  storageRows: () => AsyncIterableResult<StorageRow>,
  ctx: Context,
  annotations: Annotations,
  callerRows: DescribeCollectionRowsOptions,
): AsyncIterableResult<Row> {
  const { context, namespaceId, modelName, state } = callerRows;
  const { contract } = context;
  const { tableName } = state.tables.root.storage;
  const selected =
    state.selectedFields ?? getColumnsReadOnTable(contract, namespaceId, modelName, tableName);
  const hiddenColumns = graph
    .readersOf(id)
    .flatMap(({ edge }) => edge.columns.map(([source]) => source.alias))
    .filter((column) => !selected.includes(column));

  if (node.rowsAre === 'read') {
    return mapResultRows(consumeCollectionRows<StorageRow>(callerRows, storageRows()), (row) => {
      stripHiddenMappedFields(contract, namespaceId, modelName, row, hiddenColumns);
      return blindCast<Row, 'the row the read code shaped is the row the caller selected'>(row);
    });
  }
  return mapMutationRows<Row>(storageRows, {
    context,
    runtime: ctx.runtime,
    tables: state.tables,
    modelName,
    namespaceId,
    variantValue: state.variantValue,
    includes: state.includes,
    selectedFields: state.selectedFields,
    hiddenColumns,
    annotations,
    mapRow: (mapped) =>
      blindCast<Row, 'the mapped row of the result node is the row the caller selected'>(mapped),
  });
}

function rowsOf(executed: readonly StorageRow[] | number | undefined): readonly StorageRow[] {
  return typeof executed === 'object' ? executed : [];
}

function rowStream(executed: Executed): AsyncIterableResult<StorageRow> {
  return executed instanceof AsyncIterableResult ? executed : streamOf([]);
}

function streamOf(rows: readonly StorageRow[]): AsyncIterableResult<StorageRow> {
  const generator = async function* (): AsyncGenerator<StorageRow, void, unknown> {
    yield* rows;
  };
  return new AsyncIterableResult(generator());
}
