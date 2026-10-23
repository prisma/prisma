import type { Contract } from '@internal/contract/types';
import type { CodecRef } from '@internal/framework-components/codec';
import type { SqlStorage } from '@internal/sql-contract/types';
import type {
  AggregateExpr,
  AnyExpression,
  AnyFromSource,
  AnyJsonValueProjection,
  AnyQueryAst,
  BinaryExpr,
  CaseExpr,
  CastExpr,
  ColumnRef,
  FunctionCallExpr,
  JoinAst,
  JoinOnExpr,
  JsonArrayAggExpr,
  JsonObjectExpr,
  JsonValueProjectionVisitor,
  ListExpression,
  LiteralExpr,
  LoweredParam,
  LoweredStatement,
  NullCheckExpr,
  OperationExpr,
  OrderByItem,
  ProjectionExpr,
  ProjectionItem,
  RawExpr,
  RawQueryAst,
  SelectAst,
  SubqueryExpr,
  TableSource,
  WindowFuncExpr,
} from '@internal/sql-relational-core/ast';
import type { MysqlCodecDescriptorRegistry } from '@internal/target-mysql/codec-descriptor';
import { encodeMysqlDatetime } from '@internal/target-mysql/codecs';
import { mysqlError, mysqlQueryNotYetSupported } from '@internal/target-mysql/errors';
import { escapeLiteral, quoteIdentifier } from '@internal/target-mysql/sql-utils';
import { assertNever, InternalError } from '@internal/utils/internal-error';
import { structuredError } from '@internal/utils/structured-error';

export type MysqlContract = Contract<SqlStorage>;

interface RenderContext {
  readonly contract: MysqlContract | undefined;
  readonly codecs: MysqlCodecDescriptorRegistry;
}

/** MySQL's documented way to write an `OFFSET` with no `LIMIT`: the largest row count it takes. */
const NO_LIMIT = '18446744073709551615';

function nodeKind(value: unknown): string {
  return typeof value === 'object' && value !== null && 'kind' in value
    ? String(value.kind)
    : 'unknown';
}

function unsupported(feature: string, message: string): Error {
  return mysqlError('RUNTIME.AST_UNSUPPORTED', message, { meta: { target: 'mysql', feature } });
}

/**
 * Lowers a query AST to MySQL SQL with `?` placeholders, the params in the order the placeholders appear. The runtime adapter and the control adapter share it, so both write the same SQL for the same AST.
 */
export function renderMysqlSql(
  ast: AnyQueryAst,
  contract: MysqlContract | undefined,
  codecs: MysqlCodecDescriptorRegistry,
): LoweredStatement {
  const ctx: RenderContext = { contract, codecs };
  const params: LoweredParam[] = ast
    .collectParamRefs()
    .map((ref) =>
      ref.kind === 'prepared-param-ref'
        ? { kind: 'bind', name: ref.name }
        : { kind: 'literal', value: ref.value },
    );
  return Object.freeze({ sql: renderStatement(ast, ctx), params });
}

function renderStatement(ast: AnyQueryAst, ctx: RenderContext): string {
  switch (ast.kind) {
    case 'select':
      return renderSelect(ast, ctx);
    case 'raw-query':
      return renderParts(ast.parts, ctx);
    case 'insert':
    case 'update':
    case 'delete':
      throw mysqlQueryNotYetSupported('Writing rows');
    default:
      throw new InternalError(`Unsupported AST node kind: ${nodeKind(ast)}`);
  }
}

function renderLimitOffset(
  keyword: 'LIMIT' | 'OFFSET',
  value: SelectAst['limit'],
  ctx: RenderContext,
): string {
  if (value === undefined) return '';
  return `${keyword} ${typeof value === 'number' ? value : renderExpr(value, ctx)}`;
}

function renderSelect(ast: SelectAst, ctx: RenderContext): string {
  if (ast.locking !== undefined && ast.locking.length > 0) {
    throw unsupported(
      'locking-clause',
      'Row locks are not supported on MySQL yet, so a select cannot carry a locking clause such as FOR UPDATE',
    );
  }
  if (ast.distinctOn !== undefined && ast.distinctOn.length > 0) {
    throw unsupported('distinct-on', 'MySQL has no DISTINCT ON');
  }
  const limitClause =
    ast.limit === undefined && ast.offset !== undefined
      ? `LIMIT ${NO_LIMIT}`
      : renderLimitOffset('LIMIT', ast.limit, ctx);
  return [
    `SELECT ${ast.distinct ? 'DISTINCT ' : ''}${renderProjection(ast.projection, ctx)}`,
    ast.from === undefined ? '' : `FROM ${renderSource(ast.from, ctx)}`,
    ast.joins?.length ? ast.joins.map((join) => renderJoin(join, ctx)).join(' ') : '',
    ast.where ? `WHERE ${renderExpr(ast.where, ctx)}` : '',
    ast.groupBy?.length ? `GROUP BY ${ast.groupBy.map((e) => renderExpr(e, ctx)).join(', ')}` : '',
    ast.having ? `HAVING ${renderExpr(ast.having, ctx)}` : '',
    ast.orderBy?.length ? `ORDER BY ${renderOrderByItems(ast.orderBy, ctx)}` : '',
    limitClause,
    renderLimitOffset('OFFSET', ast.offset, ctx),
  ]
    .filter((part) => part.length > 0)
    .join(' ');
}

function renderProjection(projection: ReadonlyArray<ProjectionItem>, ctx: RenderContext): string {
  return projection
    .map((item) => `${renderExpr(item.expr, ctx)} AS ${quoteIdentifier(item.alias)}`)
    .join(', ');
}

function qualifyTable(
  table: Pick<TableSource, 'name' | 'namespaceId'>,
  ctx: RenderContext,
): string {
  if (table.namespaceId === undefined) return quoteIdentifier(table.name);
  if (ctx.contract === undefined) {
    throw new InternalError(
      `Table "${table.name}" carries namespace "${table.namespaceId}" but no contract was supplied to resolve it`,
    );
  }
  const namespace = ctx.contract.storage.namespaces[table.namespaceId];
  if (namespace?.qualifyTable === undefined) {
    throw structuredError(
      'RUNTIME.NAMESPACE_UNKNOWN',
      `Table "${table.name}" references namespace "${table.namespaceId}" which the contract does not materialise for SQL rendering`,
      {
        meta: {
          table: table.name,
          namespaceId: table.namespaceId,
          reason: namespace === undefined ? 'not-present' : 'not-materialised',
        },
      },
    );
  }
  return namespace.qualifyTable(table.name);
}

function renderTableSource(source: TableSource, ctx: RenderContext): string {
  const qualified = qualifyTable(source, ctx);
  return source.alias ? `${qualified} AS ${quoteIdentifier(source.alias)}` : qualified;
}

function renderSource(source: AnyFromSource, ctx: RenderContext): string {
  switch (source.kind) {
    case 'table-source':
      return renderTableSource(source, ctx);
    case 'derived-table-source':
      return `(${renderSelect(source.query, ctx)}) AS ${quoteIdentifier(source.alias)}`;
    case 'function-source':
      throw unsupported(
        'function-source',
        `MySQL cannot select from the set-returning function ${source.fn}`,
      );
    default:
      return assertNever(source, `Unsupported source node kind: ${nodeKind(source)}`);
  }
}

function renderExpr(expr: AnyExpression, ctx: RenderContext): string {
  switch (expr.kind) {
    case 'column-ref':
      return renderColumn(expr);
    case 'identifier-ref':
      return quoteIdentifier(expr.name);
    case 'operation':
      return renderOperation(expr, ctx);
    case 'subquery':
      return renderSubquery(expr, ctx);
    case 'aggregate':
      return renderAggregate(expr, ctx);
    case 'window-func':
      return renderWindowFunc(expr, ctx);
    case 'function-call':
      return renderFunctionCall(expr, ctx);
    case 'cast':
      return renderCast(expr, ctx);
    case 'case':
      return renderCase(expr, ctx);
    case 'json-object':
      return renderJsonObject(expr, ctx);
    case 'json-array-agg':
      return renderJsonArrayAgg(expr, ctx);
    case 'binary':
      return renderBinary(expr, ctx);
    case 'and':
      return expr.exprs.length === 0
        ? 'TRUE'
        : `(${expr.exprs.map((part) => renderExpr(part, ctx)).join(' AND ')})`;
    case 'or':
      return expr.exprs.length === 0
        ? 'FALSE'
        : `(${expr.exprs.map((part) => renderExpr(part, ctx)).join(' OR ')})`;
    case 'exists':
      return `${expr.notExists ? 'NOT ' : ''}EXISTS (${renderSelect(expr.subquery, ctx)})`;
    case 'null-check':
      return renderNullCheck(expr, ctx);
    case 'not':
      return `NOT (${renderExpr(expr.expr, ctx)})`;
    case 'param-ref':
    case 'prepared-param-ref':
      return '?';
    case 'literal':
      return renderLiteral(expr);
    case 'list':
      return renderList(expr, ctx);
    case 'raw-expr':
      return renderParts(expr.parts, ctx);
    default:
      return assertNever(expr, `Unsupported expression node kind: ${nodeKind(expr)}`);
  }
}

function renderParts(parts: RawExpr['parts'] | RawQueryAst['parts'], ctx: RenderContext): string {
  return parts.map((part) => (typeof part === 'string' ? part : renderExpr(part, ctx))).join('');
}

function renderColumn(ref: ColumnRef): string {
  return `${quoteIdentifier(ref.table)}.${quoteIdentifier(ref.column)}`;
}

function renderLiteral(expr: LiteralExpr): string {
  const { value } = expr;
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return `'${escapeLiteral(value)}'`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw unsupported('non-finite-number', `MySQL has no literal for ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return `'${encodeMysqlDatetime(value)}'`;
  const json = JSON.stringify(value);
  return json === undefined ? 'NULL' : `'${escapeLiteral(json)}'`;
}

function renderOperation(expr: OperationExpr, ctx: RenderContext): string {
  const args = expr.args.map((arg) => renderExpr(arg, ctx));
  let result = expr.lowering.template.replace(/\{\{self\}\}/g, renderExpr(expr.self, ctx));
  for (let i = 0; i < args.length; i++) {
    result = result.replace(new RegExp(`\\{\\{arg${i}\\}\\}`, 'g'), args[i] ?? '');
  }
  return result;
}

function renderSubquery(expr: SubqueryExpr, ctx: RenderContext): string {
  if (expr.query.projection.length !== 1) {
    throw structuredError(
      'RUNTIME.AST_INVALID',
      'Subquery expressions must project exactly one column',
      { meta: { node: 'subquery' } },
    );
  }
  return `(${renderSelect(expr.query, ctx)})`;
}

function needsGrouping(expr: AnyExpression): boolean {
  return expr.kind === 'operation' || expr.kind === 'subquery';
}

function grouped(expr: AnyExpression, ctx: RenderContext): string {
  const rendered = renderExpr(expr, ctx);
  return needsGrouping(expr) ? `(${rendered})` : rendered;
}

function renderNullCheck(expr: NullCheckExpr, ctx: RenderContext): string {
  return `${grouped(expr.expr, ctx)} ${expr.isNull ? 'IS NULL' : 'IS NOT NULL'}`;
}

const BINARY_OPERATORS: Readonly<Record<Exclude<BinaryExpr['op'], 'isDistinctFrom'>, string>> = {
  eq: '=',
  neq: '<>',
  isNotDistinctFrom: '<=>',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  like: 'LIKE',
  in: 'IN',
  notIn: 'NOT IN',
};

function renderBinary(expr: BinaryExpr, ctx: RenderContext): string {
  if (expr.right.kind === 'list' && expr.right.values.length === 0) {
    if (expr.op === 'in') return 'FALSE';
    if (expr.op === 'notIn') return 'TRUE';
  }
  const left = grouped(expr.left, ctx);
  const right = renderExpr(expr.right, ctx);
  if (expr.op === 'isDistinctFrom') return `NOT (${left} <=> ${right})`;
  return `${left} ${BINARY_OPERATORS[expr.op]} ${right}`;
}

function renderList(expr: ListExpression, ctx: RenderContext): string {
  if (expr.values.length === 0) return '(NULL)';
  return `(${expr.values.map((value) => renderExpr(value, ctx)).join(', ')})`;
}

function renderAggregate(expr: AggregateExpr, ctx: RenderContext): string {
  const fn = expr.fn.toUpperCase();
  return expr.expr ? `${fn}(${renderExpr(expr.expr, ctx)})` : `${fn}(*)`;
}

function renderWindowFunc(expr: WindowFuncExpr, ctx: RenderContext): string {
  const over = [
    expr.partitionBy?.length
      ? `PARTITION BY ${expr.partitionBy.map((e) => renderExpr(e, ctx)).join(', ')}`
      : '',
    expr.orderBy?.length ? `ORDER BY ${renderOrderByItems(expr.orderBy, ctx)}` : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');
  const args = expr.args.map((arg) => renderExpr(arg, ctx)).join(', ');
  return `${expr.fn.toUpperCase()}(${args}) OVER (${over})`;
}

function renderFunctionCall(expr: FunctionCallExpr, ctx: RenderContext): string {
  return `${expr.fn}(${expr.args.map((arg) => renderExpr(arg, ctx)).join(', ')})`;
}

function renderCast(expr: CastExpr, ctx: RenderContext): string {
  return `CAST(${renderExpr(expr.expr, ctx)} AS ${expr.targetType})`;
}

function renderCase(expr: CaseExpr, ctx: RenderContext): string {
  const branches = expr.branches
    .map(
      (branch) => `WHEN ${renderExpr(branch.condition, ctx)} THEN ${renderExpr(branch.value, ctx)}`,
    )
    .join(' ');
  const elseClause = expr.elseExpr === undefined ? '' : ` ELSE ${renderExpr(expr.elseExpr, ctx)}`;
  return `CASE ${branches}${elseClause} END`;
}

function projectThroughCodec(
  value: ProjectionExpr,
  codec: CodecRef,
  codecs: MysqlCodecDescriptorRegistry,
): ProjectionExpr {
  const descriptor = codecs.descriptorFor(codec.codecId);
  if (descriptor === undefined) {
    throw structuredError(
      'RUNTIME.PARAM_REF_MISSING_CODEC',
      `MySQL lowering: a JSON projection carries codecId "${codec.codecId}" but the MySQL codec registry has no entry for it. Register the extension pack that contributes this codec.`,
      { meta: { codecId: codec.codecId } },
    );
  }
  return descriptor.projectJson(value, codec);
}

function renderJsonValue(projection: AnyJsonValueProjection, ctx: RenderContext): string {
  const visitor: JsonValueProjectionVisitor<string> = {
    codec: ({ value, codec }) => renderExpr(projectThroughCodec(value, codec, ctx.codecs), ctx),
    native: ({ value }) => renderExpr(value, ctx),
    document: ({ value }) => renderExpr(value, ctx),
  };
  return projection.accept(visitor);
}

function renderJsonObject(expr: JsonObjectExpr, ctx: RenderContext): string {
  const args = expr.entries
    .flatMap((entry) => [`'${escapeLiteral(entry.key)}'`, renderJsonValue(entry.value, ctx)])
    .join(', ');
  return `JSON_OBJECT(${args})`;
}

/**
 * The element of an ordered JSON array, as JSON text. A document already is JSON; a scalar goes through `JSON_ARRAY`, so a string arrives quoted and escaped.
 */
function renderJsonElementText(projection: AnyJsonValueProjection, ctx: RenderContext): string {
  const rendered = renderJsonValue(projection, ctx);
  return projection.kind === 'document'
    ? rendered
    : `JSON_EXTRACT(JSON_ARRAY(${rendered}), '$[0]')`;
}

/**
 * `JSON_ARRAYAGG` takes no `ORDER BY`, and MySQL drops a derived table's `ORDER BY` when the outer query aggregates, so an ordered array is built as text with `GROUP_CONCAT`, which keeps its own order, and cast to JSON. The driver raises `group_concat_max_len`, so a longer array fails the cast rather than losing rows. With no rows the aggregate is NULL; an empty array is `JSON_ARRAY()`, so the column stays JSON and a nested include stays an array.
 */
function renderJsonArrayAgg(expr: JsonArrayAggExpr, ctx: RenderContext): string {
  const aggregated =
    expr.orderBy === undefined
      ? `JSON_ARRAYAGG(${renderJsonValue(expr.expr, ctx)})`
      : `CAST(CONCAT('[', GROUP_CONCAT(${renderJsonElementText(expr.expr, ctx)} ORDER BY ${renderOrderByItems(expr.orderBy, ctx)} SEPARATOR ','), ']') AS JSON)`;
  return expr.onEmpty === 'emptyArray' ? `COALESCE(${aggregated}, JSON_ARRAY())` : aggregated;
}

const ORDER_DIRECTION: Readonly<Record<OrderByItem['dir'], string>> = { asc: 'ASC', desc: 'DESC' };

/** A NULLS FIRST or NULLS LAST placement, which MySQL lacks, as a leading `IS NULL` sort key. */
const NULLS_KEY_DIRECTION: Readonly<Record<NonNullable<OrderByItem['nulls']>, string>> = {
  first: 'DESC',
  last: 'ASC',
};

function renderOrderByItem(item: OrderByItem, ctx: RenderContext): string {
  const rendered = renderExpr(item.expr, ctx);
  const ordered = `${rendered} ${ORDER_DIRECTION[item.dir]}`;
  if (item.nulls === undefined) return ordered;
  if (item.expr.collectParamRefs().length > 0) {
    throw unsupported(
      'nulls-placement-with-parameters',
      'MySQL places NULLs with a second sort key that repeats the expression, so the expression cannot carry parameters',
    );
  }
  return `${grouped(item.expr, ctx)} IS NULL ${NULLS_KEY_DIRECTION[item.nulls]}, ${ordered}`;
}

function renderOrderByItems(items: ReadonlyArray<OrderByItem>, ctx: RenderContext): string {
  return items.map((item) => renderOrderByItem(item, ctx)).join(', ');
}

function renderJoin(join: JoinAst, ctx: RenderContext): string {
  if (join.joinType === 'full') {
    throw unsupported('full-join', 'MySQL has no FULL JOIN');
  }
  if (join.lateral) {
    throw unsupported('lateral-join', 'LATERAL joins are not supported on MySQL yet');
  }
  return `${join.joinType.toUpperCase()} JOIN ${renderSource(join.source, ctx)} ON ${renderJoinOn(join.on, ctx)}`;
}

function renderJoinOn(on: JoinOnExpr, ctx: RenderContext): string {
  return on.kind === 'eq-col-join-on'
    ? `${renderColumn(on.left)} = ${renderColumn(on.right)}`
    : renderExpr(on, ctx);
}
