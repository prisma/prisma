import { APP_SPACE_ID } from '@prisma-next/framework-components/control';
import type {
  Adapter,
  AdapterProfile,
  AggregateExpr,
  AnyExpression,
  AnyFromSource,
  AnyJsonValueProjection,
  AnyQueryAst,
  BinaryExpr,
  CaseExpr,
  CastExpr,
  ColumnRef,
  DeleteAst,
  FunctionCallExpr,
  InsertAst,
  InsertValue,
  JoinAst,
  JoinOnExpr,
  JsonArrayAggExpr,
  JsonObjectExpr,
  JsonValueProjectionVisitor,
  ListExpression,
  LiteralExpr,
  LoweredParam,
  LowererContext,
  NullCheckExpr,
  OperationExpr,
  OrderByItem,
  ProjectionItem,
  RawExpr,
  RawSqlLiteral,
  SelectAst,
  SqlQueryable,
  SubqueryExpr,
  TableSource,
  UpdateAst,
  WindowFuncExpr,
} from '@prisma-next/sql-relational-core/ast';
import { isDdlNode } from '@prisma-next/sql-relational-core/ast';
import type { RawCodecInferer } from '@prisma-next/sql-relational-core/expression';
import type { SqliteDdlNode } from '@prisma-next/target-sqlite/ddl';
import { escapeLiteral, quoteIdentifier } from '@prisma-next/target-sqlite/sql-utils';
import { assertNever, InternalError } from '@prisma-next/utils/internal-error';
import { structuredError } from '@prisma-next/utils/structured-error';
import { createSqliteCodecRegistryWithBuiltins } from './codec-lookup';
import { SqliteControlAdapter } from './control-adapter';
import type {
  SqliteAdapterOptions,
  SqliteCodecRegistry,
  SqliteContract,
  SqliteLoweredStatement,
} from './types';

function nodeKind(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof value.kind === 'string'
  ) {
    return value.kind;
  }
  return 'unknown';
}

function unreachableKind(value: never): string {
  return nodeKind(value);
}

const defaultCapabilities = Object.freeze({
  sql: {
    orderBy: true,
    limit: true,
    lateral: false,
    jsonAgg: true,
    returning: true,
    enums: false,
  },
});

class SqliteAdapterImpl implements Adapter<AnyQueryAst, SqliteContract, SqliteLoweredStatement> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'sqlite' as const;

  readonly profile: AdapterProfile<'sqlite'>;

  constructor(codecRegistry: SqliteCodecRegistry, profileId?: string) {
    const controlAdapter = new SqliteControlAdapter(codecRegistry);
    this.profile = Object.freeze({
      id: profileId ?? 'sqlite/default@1',
      target: 'sqlite',
      capabilities: defaultCapabilities,
      readMarker: (queryable: SqlQueryable) =>
        controlAdapter.readMarkerDiscriminated(
          {
            familyId: 'sql',
            targetId: 'sqlite',
            query: async <Row = Record<string, unknown>>(
              sql: string,
              params?: readonly unknown[],
            ) => {
              const result = await queryable.query<Row>(sql, params);
              return { rows: [...result.rows] };
            },
            close: async () => {},
          },
          APP_SPACE_ID,
        ),
    });
  }

  lower(
    ast: AnyQueryAst | SqliteDdlNode,
    context: LowererContext<SqliteContract>,
  ): SqliteLoweredStatement {
    if (isDdlNode(ast)) {
      throw structuredError(
        'RUNTIME.DDL_UNSUPPORTED',
        'lower() does not lower DDL on the runtime adapter — DDL lowering is a control-plane concern handled by the control adapter.',
        { meta: { surface: 'runtime-adapter' } },
      );
    }
    return renderLoweredSql(ast, context.contract);
  }
}

/** Codec-id lookup for bare-literal interpolations used by `fns.raw` on a sqlite client. Contributed as the descriptor's static `rawCodecInferer` slot. */
export const sqliteRawCodecInferer: RawCodecInferer = {
  inferCodec(value: RawSqlLiteral): string {
    switch (typeof value) {
      case 'number':
        return Number.isSafeInteger(value) && value % 1 === 0
          ? 'sqlite/integer@1'
          : 'sqlite/real@1';
      case 'bigint':
        return 'sqlite/bigint@1';
      case 'string':
        return 'sqlite/text@1';
      case 'boolean':
        return 'sqlite/integer@1';
      case 'object':
        if (value instanceof Uint8Array) return 'sqlite/blob@1';
    }
    throw structuredError(
      'RUNTIME.RAW_SQL_UNSUPPORTED_INTERPOLATION',
      'unsupported JS value type for raw-SQL interpolation: wrap this value in `param(...)` with an explicit codec',
      { meta: { valueType: typeof value } },
    );
  },
};

/**
 * Lower a SQL query AST into a SQLite-flavored `{ sql, params }` payload.
 *
 * Shared between the runtime adapter (`SqliteAdapterImpl.lower`) and the control adapter (`SqliteControlAdapter.lower`) so both produce byte-identical SQL for the same AST and contract.
 */
export function renderLoweredSql(
  ast: AnyQueryAst,
  contract: SqliteContract,
): SqliteLoweredStatement {
  const collectedParamRefs = ast.collectParamRefs();
  const params: LoweredParam[] = [];
  for (const ref of collectedParamRefs) {
    params.push(
      ref.kind === 'prepared-param-ref'
        ? { kind: 'bind', name: ref.name }
        : { kind: 'literal', value: ref.value },
    );
  }

  let sql: string;

  const node = ast;
  switch (node.kind) {
    case 'select':
      sql = renderSelect(node, contract);
      break;
    case 'insert':
      sql = renderInsert(node, contract);
      break;
    case 'update':
      sql = renderUpdate(node, contract);
      break;
    case 'delete':
      sql = renderDelete(node, contract);
      break;
    default:
      throw new InternalError(`Unsupported AST node kind: ${nodeKind(node)}`);
  }

  return Object.freeze({ sql, params });
}

function renderLimitOffset(
  keyword: 'LIMIT' | 'OFFSET',
  value: SelectAst['limit'] | SelectAst['offset'],
  contract?: SqliteContract,
): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return `${keyword} ${value}`;
  return `${keyword} ${renderExpr(value, contract)}`;
}

function renderSelect(ast: SelectAst, contract: SqliteContract): string {
  const distinctPrefix = ast.distinct ? 'DISTINCT ' : '';
  const selectClause = `SELECT ${distinctPrefix}${renderProjection(ast.projection, contract)}`;
  const fromClause = ast.from !== undefined ? `FROM ${renderSource(ast.from, contract)}` : '';

  const joinsClause = ast.joins?.length
    ? ast.joins.map((join) => renderJoin(join, contract)).join(' ')
    : '';

  const whereClause = ast.where ? `WHERE ${renderExpr(ast.where, contract)}` : '';
  const groupByClause = ast.groupBy?.length
    ? `GROUP BY ${ast.groupBy.map((expr) => renderExpr(expr, contract)).join(', ')}`
    : '';
  const havingClause = ast.having ? `HAVING ${renderExpr(ast.having, contract)}` : '';
  const orderClause = ast.orderBy?.length
    ? `ORDER BY ${ast.orderBy
        .map((order) => `${renderExpr(order.expr, contract)} ${order.dir.toUpperCase()}`)
        .join(', ')}`
    : '';
  const limitClause = renderLimitOffset('LIMIT', ast.limit, contract);
  const offsetClause = renderLimitOffset('OFFSET', ast.offset, contract);

  return [
    selectClause,
    fromClause,
    joinsClause,
    whereClause,
    groupByClause,
    havingClause,
    orderClause,
    limitClause,
    offsetClause,
  ]
    .filter((part) => part.length > 0)
    .join(' ')
    .trim();
}

function renderProjection(
  projection: ReadonlyArray<ProjectionItem>,
  contract?: SqliteContract,
): string {
  return projection
    .map((item) => {
      const alias = quoteIdentifier(item.alias);
      if (item.expr.kind === 'literal') {
        return `${renderLiteral(item.expr)} AS ${alias}`;
      }
      return `${renderExpr(item.expr, contract)} AS ${alias}`;
    })
    .join(', ');
}

function qualifyTableFromNamespaceCoordinate(
  table: Pick<TableSource, 'name' | 'namespaceId'>,
  contract: SqliteContract,
): string {
  if (table.namespaceId === undefined) {
    return quoteIdentifier(table.name);
  }
  const namespace = contract.storage.namespaces[table.namespaceId];
  if (namespace === undefined) {
    throw structuredError(
      'RUNTIME.NAMESPACE_UNKNOWN',
      `Table "${table.name}" references namespace "${table.namespaceId}" which is not present on the contract`,
      { meta: { table: table.name, namespaceId: table.namespaceId, reason: 'not-present' } },
    );
  }
  const qualifyTable = namespace.qualifyTable;
  if (qualifyTable === undefined) {
    throw structuredError(
      'RUNTIME.NAMESPACE_UNKNOWN',
      `Table "${table.name}" references namespace "${table.namespaceId}" which is not materialised for SQL rendering on the contract`,
      { meta: { table: table.name, namespaceId: table.namespaceId, reason: 'not-materialised' } },
    );
  }
  return qualifyTable.call(namespace, table.name);
}

function renderTableSource(source: TableSource, contract: SqliteContract): string {
  const qualified = qualifyTableFromNamespaceCoordinate(source, contract);
  if (!source.alias) {
    return qualified;
  }
  return `${qualified} AS ${quoteIdentifier(source.alias)}`;
}

function renderSource(source: AnyFromSource, contract: SqliteContract): string {
  const node = source;
  switch (node.kind) {
    case 'table-source':
      return renderTableSource(node, contract);
    case 'derived-table-source':
      return `(${renderSelect(node.query, contract)}) AS ${quoteIdentifier(node.alias)}`;
    case 'function-source': {
      if (node.ordinality) {
        throw structuredError(
          'ADAPTER.CAPABILITY_MISSING',
          'SQLite does not support WITH ORDINALITY on function sources',
          { meta: { target: 'sqlite', feature: 'function-source-with-ordinality' } },
        );
      }
      if (node.columnAliases !== undefined) {
        throw structuredError(
          'ADAPTER.CAPABILITY_MISSING',
          'SQLite does not support returned-column aliases on function sources',
          { meta: { target: 'sqlite', feature: 'function-source-column-aliases' } },
        );
      }
      const args = node.args.map((arg) => renderExpr(arg, contract)).join(', ');
      const call = `${node.fn}(${args})`;
      return node.alias !== undefined ? `${call} AS ${quoteIdentifier(node.alias)}` : call;
    }
    default:
      return assertNever(node, `Unsupported source node kind: ${unreachableKind(node)}`);
  }
}

function renderExpr(expr: AnyExpression, contract?: SqliteContract): string {
  const node = expr;
  switch (node.kind) {
    case 'column-ref':
      return renderColumn(node);
    case 'identifier-ref':
      return quoteIdentifier(node.name);
    case 'operation':
      return renderOperation(node, contract);
    case 'subquery':
      return renderSubqueryExpr(node, contract);
    case 'aggregate':
      return renderAggregateExpr(node, contract);
    case 'window-func':
      return renderWindowFuncExpr(node, contract);
    case 'function-call':
      return renderFunctionCallExpr(node, contract);
    case 'cast':
      return renderCastExpr(node, contract);
    case 'case':
      return renderCaseExpr(node, contract);
    case 'json-object':
      return renderJsonObjectExpr(node, contract);
    case 'json-array-agg':
      return renderJsonArrayAggExpr(node, contract);
    case 'binary':
      return renderBinary(node, contract);
    case 'and':
      if (node.exprs.length === 0) {
        return 'TRUE';
      }
      return `(${node.exprs.map((part) => renderExpr(part, contract)).join(' AND ')})`;
    case 'or':
      if (node.exprs.length === 0) {
        return 'FALSE';
      }
      return `(${node.exprs.map((part) => renderExpr(part, contract)).join(' OR ')})`;
    case 'exists': {
      if (contract === undefined) {
        throw new InternalError('EXISTS subquery rendering requires a Sqlite contract');
      }
      const notKeyword = node.notExists ? 'NOT ' : '';
      const subquery = renderSelect(node.subquery, contract);
      return `${notKeyword}EXISTS (${subquery})`;
    }
    case 'null-check':
      return renderNullCheck(node, contract);
    case 'not':
      return `NOT (${renderExpr(node.expr, contract)})`;
    case 'param-ref':
    case 'prepared-param-ref':
      return '?';
    case 'literal':
      return renderLiteral(node);
    case 'list':
      return renderListLiteral(node);
    case 'raw-expr':
      return renderRawExpr(node, contract);
    default:
      return assertNever(node, `Unsupported expression node kind: ${unreachableKind(node)}`);
  }
}

function renderRawExpr(node: RawExpr, contract?: SqliteContract): string {
  return node.parts
    .map((part) => (typeof part === 'string' ? part : renderExpr(part, contract)))
    .join('');
}

// `excluded` is a pseudo-table in ON CONFLICT DO UPDATE that references the row proposed for insertion. It is not quoted because it's a keyword.
function renderColumn(ref: ColumnRef): string {
  if (ref.table === 'excluded') {
    return `excluded.${quoteIdentifier(ref.column)}`;
  }
  return `${quoteIdentifier(ref.table)}.${quoteIdentifier(ref.column)}`;
}

function renderLiteral(expr: LiteralExpr): string {
  if (typeof expr.value === 'string') {
    return `'${escapeLiteral(expr.value)}'`;
  }
  if (typeof expr.value === 'number' || typeof expr.value === 'boolean') {
    return String(expr.value);
  }
  if (typeof expr.value === 'bigint') {
    return String(expr.value);
  }
  if (expr.value === null || expr.value === undefined) {
    return 'NULL';
  }
  if (expr.value instanceof Date) {
    return `'${escapeLiteral(expr.value.toISOString())}'`;
  }
  const json = JSON.stringify(expr.value);
  if (json === undefined) {
    return 'NULL';
  }
  return `'${escapeLiteral(json)}'`;
}

function renderOperation(expr: OperationExpr, contract?: SqliteContract): string {
  const self = renderExpr(expr.self, contract);
  const args = expr.args.map((arg) => renderExpr(arg, contract));

  let result = expr.lowering.template;
  result = result.replace(/\{\{self\}\}/g, self);
  for (let i = 0; i < args.length; i++) {
    result = result.replace(new RegExp(`\\{\\{arg${i}\\}\\}`, 'g'), args[i] ?? '');
  }

  return result;
}

function renderSubqueryExpr(expr: SubqueryExpr, contract?: SqliteContract): string {
  if (expr.query.projection.length !== 1) {
    throw structuredError(
      'RUNTIME.AST_INVALID',
      'Subquery expressions must project exactly one column',
      { meta: { node: 'subquery' } },
    );
  }
  if (contract === undefined) {
    throw new InternalError('Subquery expression rendering requires a Sqlite contract');
  }
  return `(${renderSelect(expr.query, contract)})`;
}

function requiresNullCheckGrouping(kind: AnyExpression['kind']): boolean {
  switch (kind) {
    case 'operation':
    case 'subquery':
      return true;
    case 'column-ref':
    case 'identifier-ref':
    case 'aggregate':
    case 'window-func':
    case 'function-call':
    case 'cast':
    case 'case':
    case 'json-object':
    case 'json-array-agg':
    case 'binary':
    case 'and':
    case 'or':
    case 'exists':
    case 'null-check':
    case 'not':
    case 'param-ref':
    case 'prepared-param-ref':
    case 'literal':
    case 'list':
    case 'raw-expr':
      return false;
  }
}

function renderNullCheck(expr: NullCheckExpr, contract?: SqliteContract): string {
  const rendered = renderExpr(expr.expr, contract);
  const renderedExpr = requiresNullCheckGrouping(expr.expr.kind) ? `(${rendered})` : rendered;
  return expr.isNull ? `${renderedExpr} IS NULL` : `${renderedExpr} IS NOT NULL`;
}

function renderBinary(expr: BinaryExpr, contract?: SqliteContract): string {
  if (expr.right.kind === 'list' && expr.right.values.length === 0) {
    if (expr.op === 'in') {
      return 'FALSE';
    }
    if (expr.op === 'notIn') {
      return 'TRUE';
    }
  }

  const leftExpr = expr.left;
  const left = renderExpr(leftExpr, contract);
  const leftRendered =
    leftExpr.kind === 'operation' || leftExpr.kind === 'subquery' ? `(${left})` : left;

  const rightNode = expr.right;
  let right: string;
  switch (rightNode.kind) {
    case 'list':
      right = renderListLiteral(rightNode);
      break;
    case 'literal':
      right = renderLiteral(rightNode);
      break;
    case 'column-ref':
      right = renderColumn(rightNode);
      break;
    case 'param-ref':
    case 'prepared-param-ref':
      right = '?';
      break;
    default:
      right = renderExpr(rightNode, contract);
      break;
  }

  const operatorMap: Record<BinaryExpr['op'], string> = {
    eq: '=',
    neq: '!=',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
    like: 'LIKE',
    in: 'IN',
    notIn: 'NOT IN',
  };

  return `${leftRendered} ${operatorMap[expr.op]} ${right}`;
}

function renderListLiteral(expr: ListExpression): string {
  if (expr.values.length === 0) {
    return '(NULL)';
  }
  const values = expr.values
    .map((v) => {
      if (v.kind === 'param-ref' || v.kind === 'prepared-param-ref') return '?';
      if (v.kind === 'literal') return renderLiteral(v);
      return renderExpr(v);
    })
    .join(', ');
  return `(${values})`;
}

function renderAggregateExpr(expr: AggregateExpr, contract?: SqliteContract): string {
  const fn = expr.fn.toUpperCase();
  if (!expr.expr) {
    return `${fn}(*)`;
  }
  return `${fn}(${renderExpr(expr.expr, contract)})`;
}

function renderWindowFuncExpr(expr: WindowFuncExpr, contract?: SqliteContract): string {
  const fn = expr.fn.toUpperCase();
  const args = expr.args.map((arg) => renderExpr(arg, contract)).join(', ');
  const partitionClause =
    expr.partitionBy && expr.partitionBy.length > 0
      ? `PARTITION BY ${expr.partitionBy.map((e) => renderExpr(e, contract)).join(', ')}`
      : '';
  const orderClause =
    expr.orderBy && expr.orderBy.length > 0
      ? `ORDER BY ${renderOrderByItems(expr.orderBy, contract)}`
      : '';
  const over = [partitionClause, orderClause].filter((part) => part.length > 0).join(' ');
  return `${fn}(${args}) OVER (${over})`;
}

function renderFunctionCallExpr(expr: FunctionCallExpr, contract?: SqliteContract): string {
  const args = expr.args.map((arg) => renderExpr(arg, contract)).join(', ');
  return `${expr.fn}(${args})`;
}

function renderCastExpr(expr: CastExpr, contract?: SqliteContract): string {
  return `CAST(${renderExpr(expr.expr, contract)} AS ${expr.targetType})`;
}

function renderCaseExpr(expr: CaseExpr, contract?: SqliteContract): string {
  const branches = expr.branches
    .map(
      (branch) =>
        `WHEN ${renderExpr(branch.condition, contract)} THEN ${renderExpr(branch.value, contract)}`,
    )
    .join(' ');
  const elseClause =
    expr.elseExpr === undefined ? '' : ` ELSE ${renderExpr(expr.elseExpr, contract)}`;
  return `CASE ${branches}${elseClause} END`;
}

function renderJsonValueProjection(
  projection: AnyJsonValueProjection,
  contract?: SqliteContract,
): string {
  const visitor: JsonValueProjectionVisitor<string> = {
    codec: ({ value }) => renderExpr(value, contract),
    native: ({ value }) => renderExpr(value, contract),
    document: ({ value }) => renderExpr(value, contract),
  };
  return projection.accept(visitor);
}

function renderJsonObjectExpr(expr: JsonObjectExpr, contract?: SqliteContract): string {
  const args = expr.entries
    .flatMap((entry): [string, string] => {
      const key = `'${escapeLiteral(entry.key)}'`;
      return [key, renderJsonValueProjection(entry.value, contract)];
    })
    .join(', ');
  return `json_object(${args})`;
}

function renderOrderByItems(items: ReadonlyArray<OrderByItem>, contract?: SqliteContract): string {
  return items
    .map((item) => `${renderExpr(item.expr, contract)} ${item.dir.toUpperCase()}`)
    .join(', ');
}

function renderJsonArrayAggExpr(expr: JsonArrayAggExpr, contract?: SqliteContract): string {
  const aggregateOrderBy =
    expr.orderBy && expr.orderBy.length > 0
      ? ` ORDER BY ${renderOrderByItems(expr.orderBy, contract)}`
      : '';
  const aggregated = `json_group_array(${renderJsonValueProjection(expr.expr, contract)}${aggregateOrderBy})`;
  if (expr.onEmpty === 'emptyArray') {
    return `coalesce(${aggregated}, '[]')`;
  }
  return aggregated;
}

function renderJoin(join: JoinAst, contract?: SqliteContract): string {
  if (contract === undefined) {
    throw new InternalError('JOIN rendering requires a Sqlite contract');
  }
  const joinType = join.joinType.toUpperCase();
  const source = renderSource(join.source, contract);
  const onClause = renderJoinOn(join.on, contract);
  return `${joinType} JOIN ${source} ON ${onClause}`;
}

function renderJoinOn(on: JoinOnExpr, contract?: SqliteContract): string {
  if (on.kind === 'eq-col-join-on') {
    return `${renderColumn(on.left)} = ${renderColumn(on.right)}`;
  }
  return renderExpr(on, contract);
}

function renderInsertValue(value: InsertValue): string {
  switch (value.kind) {
    case 'param-ref':
    case 'prepared-param-ref':
      return '?';
    case 'column-ref':
      return renderColumn(value);
    case 'raw-expr':
      return renderExpr(value);
    case 'default-value':
      throw structuredError(
        'RUNTIME.AST_UNSUPPORTED',
        'SQLite does not support DEFAULT as a value in INSERT ... VALUES',
        { meta: { node: 'default-value' } },
      );
    default:
      return assertNever(value, `Unsupported value node in INSERT: ${unreachableKind(value)}`);
  }
}

function renderInsert(ast: InsertAst, contract: SqliteContract): string {
  const table = qualifyTableFromNamespaceCoordinate(ast.table, contract);
  const rows = ast.rows;
  const firstRow = rows[0];
  if (firstRow === undefined) {
    throw structuredError('RUNTIME.AST_INVALID', 'INSERT requires at least one row', {
      meta: { node: 'insert', table: ast.table.name },
    });
  }

  const columnOrder = Object.keys(firstRow);

  let insertClause: string;
  if (columnOrder.length === 0) {
    insertClause = `INSERT INTO ${table} DEFAULT VALUES`;
  } else {
    const columns = columnOrder.map((column) => quoteIdentifier(column));
    const values = rows
      .map((row) => {
        const renderedRow = columnOrder.map((column) => {
          const value = row[column];
          if (value === undefined) {
            throw structuredError(
              'RUNTIME.AST_INVALID',
              `Missing value for column "${column}" in INSERT row`,
              { meta: { node: 'insert', table: ast.table.name, column } },
            );
          }
          return renderInsertValue(value);
        });
        return `(${renderedRow.join(', ')})`;
      })
      .join(', ');
    insertClause = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`;
  }

  let onConflictClause = '';
  if (ast.onConflict) {
    const conflictColumns = ast.onConflict.columns.map((col) => quoteIdentifier(col.column));
    if (conflictColumns.length === 0) {
      throw structuredError(
        'RUNTIME.AST_INVALID',
        'INSERT onConflict requires at least one conflict column',
        { meta: { node: 'insert', table: ast.table.name } },
      );
    }

    const action = ast.onConflict.action;
    switch (action.kind) {
      case 'do-nothing':
        onConflictClause = ` ON CONFLICT (${conflictColumns.join(', ')}) DO NOTHING`;
        break;
      case 'do-update-set': {
        const updates = Object.entries(action.set).map(([colName, value]) => {
          return `${quoteIdentifier(colName)} = ${renderExpr(value, contract)}`;
        });
        onConflictClause = ` ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updates.join(', ')}`;
        break;
      }
      default:
        assertNever(action, `Unsupported onConflict action: ${unreachableKind(action)}`);
    }
  }

  const returningClause = renderReturning(ast.returning);

  return `${insertClause}${onConflictClause}${returningClause}`;
}

function renderUpdate(ast: UpdateAst, contract: SqliteContract): string {
  const table = qualifyTableFromNamespaceCoordinate(ast.table, contract);
  const setClauses = Object.entries(ast.set).map(([col, val]) => {
    return `${quoteIdentifier(col)} = ${renderExpr(val, contract)}`;
  });

  const whereClause = ast.where ? ` WHERE ${renderExpr(ast.where, contract)}` : '';
  const returningClause = renderReturning(ast.returning);

  return `UPDATE ${table} SET ${setClauses.join(', ')}${whereClause}${returningClause}`;
}

function renderDelete(ast: DeleteAst, contract: SqliteContract): string {
  const table = qualifyTableFromNamespaceCoordinate(ast.table, contract);
  const whereClause = ast.where ? ` WHERE ${renderExpr(ast.where)}` : '';
  const returningClause = renderReturning(ast.returning);

  return `DELETE FROM ${table}${whereClause}${returningClause}`;
}

function renderReturning(returning: ReadonlyArray<ProjectionItem> | undefined): string {
  if (!returning?.length) {
    return '';
  }
  return ` RETURNING ${returning
    .map((item) => {
      if (item.expr.kind === 'column-ref') {
        const rendered = `${quoteIdentifier(item.expr.table)}.${quoteIdentifier(item.expr.column)}`;
        return item.expr.column === item.alias
          ? rendered
          : `${rendered} AS ${quoteIdentifier(item.alias)}`;
      }
      return `${renderExpr(item.expr)} AS ${quoteIdentifier(item.alias)}`;
    })
    .join(', ')}`;
}

export function createSqliteAdapter(options?: SqliteAdapterOptions) {
  const codecRegistry = createSqliteCodecRegistryWithBuiltins(options?.codecDescriptors);
  return Object.freeze(new SqliteAdapterImpl(codecRegistry, options?.profileId));
}

export function createSqliteAdapterWithCodecRegistry(codecRegistry: SqliteCodecRegistry) {
  return Object.freeze(new SqliteAdapterImpl(codecRegistry));
}
