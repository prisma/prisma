import type { SqlOperationEntry } from '@prisma-next/sql-operations';
import type { AggregateFn } from '@prisma-next/sql-relational-core/ast';
import {
  AggregateExpr,
  AndExpr,
  type AnyExpression as AstExpression,
  BinaryExpr,
  type BinaryOp,
  type CodecRef,
  ExistsExpr,
  ListExpression,
  LiteralExpr,
  NullCheckExpr,
  OrExpr,
  SubqueryExpr,
} from '@prisma-next/sql-relational-core/ast';
import type { RawCodecInferer } from '@prisma-next/sql-relational-core/expression';
import { codecOf, createRawSql, toExpr } from '@prisma-next/sql-relational-core/expression';
import type { SqlAggregateDescriptorRegistry } from '@prisma-next/sql-relational-core/query-lane-context';
import { ifDefined } from '@prisma-next/utils/defined';
import type {
  AggregateFunctions,
  BooleanCodecType,
  BuiltinFunctions,
  CodecExpression,
  Expression,
  Functions,
} from '../expression';
import type { QueryContext, ScopeField, Subquery } from '../scope';
import { ExpressionImpl } from './expression-impl';

type CodecTypes = Record<string, { readonly input: unknown }>;
// Runtime-level ExprOrVal — accepts any codec, any nullability. Concrete codec typing lives on the public BuiltinFunctions surface in `../expression`.
type ExprOrVal<CodecId extends string = string, N extends boolean = boolean> = CodecExpression<
  CodecId,
  N,
  CodecTypes
>;

const BOOL_FIELD: BooleanCodecType = { codecId: 'pg/bool@1', nullable: false };

const resolve = toExpr;

/**
 * Resolve a binary-comparison operand into an AST expression, threading the column-bound side's {@link CodecRef} to the raw-value side.
 *
 * For `fns.eq(f.email, 'alice@example.com')`, `f.email` is the column-bound expression carrying a `ColumnRef` AST and a `CodecRef` derived from contract storage; the raw string operand has no codec context. By deriving the codec context from the column-bound side and forwarding it via `toExpr(value, codec)`, the resulting `ParamRef` carries the `CodecRef` that encode-side dispatch needs to materialise the per-instance codec for parameterized codec ids (`vector(1024)` vs. `vector(1536)`).
 */
function resolveOperand(operand: ExprOrVal, otherCodec?: CodecRef): AstExpression {
  if (isExpressionLike(operand)) return operand.buildAst();
  return toExpr(operand, otherCodec);
}

function isExpressionLike(
  value: unknown,
): value is { buildAst: () => AstExpression; returnType?: { codecId: string } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buildAst' in value &&
    typeof (value as { buildAst: unknown }).buildAst === 'function'
  );
}

/**
 * Resolves an Expression via `buildAst()`, or wraps a raw value as a `LiteralExpr` — an SQL literal inlined into the query text, not a bound parameter.
 *
 * Used for `and` / `or` operands. The usual operand is an `Expression<bool>` (e.g. the result of `fns.eq`), which this function passes through by calling `buildAst()`. The only time the raw-value branch fires is when the caller writes `fns.and(true, x)` or similar — inlining `TRUE`/`FALSE` literals lets the SQL planner statically simplify `TRUE AND x` to `x`, which it cannot do for an opaque `ParamRef`.
 */
function toLiteralExpr(value: unknown): AstExpression {
  if (
    typeof value === 'object' &&
    value !== null &&
    'buildAst' in value &&
    typeof (value as { buildAst: unknown }).buildAst === 'function'
  ) {
    return (value as { buildAst(): AstExpression }).buildAst();
  }
  return new LiteralExpr(value);
}

function boolExpr(astNode: AstExpression): ExpressionImpl<BooleanCodecType> {
  return new ExpressionImpl(astNode, BOOL_FIELD);
}

function binaryWithSharedCodec(
  a: ExprOrVal,
  b: ExprOrVal,
  build: (left: AstExpression, right: AstExpression) => AstExpression,
): AstExpression {
  const aCodec = codecOf(a);
  const bCodec = codecOf(b);
  const left = resolveOperand(a, bCodec);
  const right = resolveOperand(b, aCodec);
  return build(left, right);
}

function eq(a: ExprOrVal, b: ExprOrVal): ExpressionImpl<BooleanCodecType> {
  if (b === null) return boolExpr(NullCheckExpr.isNull(resolve(a)));
  if (a === null) return boolExpr(NullCheckExpr.isNull(resolve(b)));
  return boolExpr(binaryWithSharedCodec(a, b, (l, r) => new BinaryExpr('eq', l, r)));
}

function ne(a: ExprOrVal, b: ExprOrVal): ExpressionImpl<BooleanCodecType> {
  if (b === null) return boolExpr(NullCheckExpr.isNotNull(resolve(a)));
  if (a === null) return boolExpr(NullCheckExpr.isNotNull(resolve(b)));
  return boolExpr(binaryWithSharedCodec(a, b, (l, r) => new BinaryExpr('neq', l, r)));
}

function comparison(a: ExprOrVal, b: ExprOrVal, op: BinaryOp): ExpressionImpl<BooleanCodecType> {
  return boolExpr(binaryWithSharedCodec(a, b, (l, r) => new BinaryExpr(op, l, r)));
}

function inOrNotIn(
  expr: Expression<ScopeField>,
  valuesOrSubquery: Subquery<Record<string, ScopeField>> | ExprOrVal[],
  op: 'in' | 'notIn',
): ExpressionImpl<BooleanCodecType> {
  const left = expr.buildAst();
  const leftCodec = codecOf(expr);
  const binaryFn = op === 'in' ? BinaryExpr.in : BinaryExpr.notIn;

  if (Array.isArray(valuesOrSubquery)) {
    const refs = valuesOrSubquery.map((v) => resolveOperand(v, leftCodec));
    return boolExpr(binaryFn(left, ListExpression.of(refs)));
  }
  return boolExpr(binaryFn(left, SubqueryExpr.of(valuesOrSubquery.buildAst())));
}

/**
 * Build an aggregate through the target's own answer for it.
 *
 * What an aggregate returns is neither the input's codec nor a fixed id: a
 * target widens `sum` over small integers, takes `avg` somewhere else again,
 * and may want the result rendered a particular way. All three come from the
 * registry, and the result carries the codec it declared so decoding resolves
 * through the ordinary path.
 */
function aggregate(
  aggregates: SqlAggregateDescriptorRegistry,
  fn: AggregateFn,
  expr: Expression<ScopeField> | undefined,
): ExpressionImpl<{ codecId: string; nullable: boolean; codec?: CodecRef }> {
  const field = expr?.returnType;
  const inputCodec = field === undefined ? undefined : (field.codec ?? { codecId: field.codecId });
  const resolved = aggregates.resolve(fn, inputCodec);
  const inputAst = expr?.buildAst();

  const ast =
    resolved?.lower !== undefined
      ? resolved.lower({ expr: inputAst, inputCodec })
      : new AggregateExpr(fn, inputAst);

  // An operation the target declares no overload for carries no codec: the
  // value reads back as the driver hands it over, which is honest, where naming
  // the input's codec would claim the result decodes like its input. SQLite has
  // pairs of exactly this kind — `sum` over text reads whatever leading numbers
  // the rows happened to hold — and the claim would be false for every one.
  // `codecId` keeps the input's, since operator gating still has to say
  // something about the expression's shape.
  const output = resolved?.output;
  return new ExpressionImpl(ast, {
    codecId: output?.codecId ?? field?.codecId ?? 'unknown',
    nullable: resolved?.nullable ?? true,
    ...ifDefined('codec', output),
  });
}

function createBuiltinFunctions(rawCodecInferer: RawCodecInferer) {
  return {
    eq: (a: ExprOrVal, b: ExprOrVal) => eq(a, b),
    ne: (a: ExprOrVal, b: ExprOrVal) => ne(a, b),
    gt: (a: ExprOrVal, b: ExprOrVal) => comparison(a, b, 'gt'),
    gte: (a: ExprOrVal, b: ExprOrVal) => comparison(a, b, 'gte'),
    lt: (a: ExprOrVal, b: ExprOrVal) => comparison(a, b, 'lt'),
    lte: (a: ExprOrVal, b: ExprOrVal) => comparison(a, b, 'lte'),
    and: (...exprs: ExprOrVal<'pg/bool@1', boolean>[]) =>
      boolExpr(AndExpr.of(exprs.map(toLiteralExpr))),
    or: (...exprs: ExprOrVal<'pg/bool@1', boolean>[]) =>
      boolExpr(OrExpr.of(exprs.map(toLiteralExpr))),
    exists: (subquery: Subquery<Record<string, ScopeField>>) =>
      boolExpr(ExistsExpr.exists(subquery.buildAst())),
    notExists: (subquery: Subquery<Record<string, ScopeField>>) =>
      boolExpr(ExistsExpr.notExists(subquery.buildAst())),
    in: (
      expr: Expression<ScopeField>,
      valuesOrSubquery: Subquery<Record<string, ScopeField>> | ExprOrVal[],
    ) => inOrNotIn(expr, valuesOrSubquery, 'in'),
    notIn: (
      expr: Expression<ScopeField>,
      valuesOrSubquery: Subquery<Record<string, ScopeField>> | ExprOrVal[],
    ) => inOrNotIn(expr, valuesOrSubquery, 'notIn'),
    raw: createRawSql(rawCodecInferer),
  } satisfies BuiltinFunctions<CodecTypes>;
}

/**
 * The aggregate implementations, erased.
 *
 * What each returns is the contract's answer — a function of the target's map
 * and the input's codec — which no runtime value can state. The typed surface
 * is `AggregateFunctions<QC>`, applied where these are handed out.
 */
function createAggregateOnlyFunctions(aggregates: SqlAggregateDescriptorRegistry) {
  return {
    count: (expr?: Expression<ScopeField>) => aggregate(aggregates, 'count', expr),
    sum: (expr: Expression<ScopeField>) => aggregate(aggregates, 'sum', expr),
    avg: (expr: Expression<ScopeField>) => aggregate(aggregates, 'avg', expr),
    min: (expr: Expression<ScopeField>) => aggregate(aggregates, 'min', expr),
    max: (expr: Expression<ScopeField>) => aggregate(aggregates, 'max', expr),
  };
}

export function createFunctions<QC extends QueryContext>(
  operations: Readonly<Record<string, SqlOperationEntry>>,
  rawCodecInferer: RawCodecInferer,
): Functions<QC> {
  const builtins = createBuiltinFunctions(rawCodecInferer);

  return new Proxy({} as Functions<QC>, {
    get(_target, prop: string) {
      if (Object.hasOwn(builtins, prop)) {
        return (builtins as Record<string, unknown>)[prop];
      }

      const op = operations[prop];
      if (op) return op.impl;
      return undefined;
    },
  });
}

export function createAggregateFunctions<QC extends QueryContext>(
  operations: Readonly<Record<string, SqlOperationEntry>>,
  rawCodecInferer: RawCodecInferer,
  aggregateRegistry: SqlAggregateDescriptorRegistry,
): AggregateFunctions<QC> {
  const baseFns = createFunctions<QC>(operations, rawCodecInferer);
  const aggregates = createAggregateOnlyFunctions(aggregateRegistry);

  return new Proxy({} as AggregateFunctions<QC>, {
    get(_target, prop: string) {
      const agg = (aggregates as Record<string, unknown>)[prop];
      if (agg) return agg;

      return (baseFns as Record<string, unknown>)[prop];
    },
  });
}
