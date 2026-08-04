import type { QueryOperationTypesBase } from '@internal/sql-contract/types';
import type {
  CodecExpression,
  Expression,
  RawSqlTag,
  TraitExpression,
} from '@internal/sql-relational-core/expression';
import type { Expand, QueryContext, Scope, ScopeField, ScopeTable, Subquery } from './scope';

export type { CodecExpression, Expression, RawSqlTag, TraitExpression };

export type BooleanCodecType = { codecId: 'pg/bool@1'; nullable: boolean };

export type WithField<Source, Field extends ScopeField, Alias extends string> = Expand<
  Source & { [K in Alias]: Field }
>;

export type WithFields<
  Source,
  FromScope extends ScopeTable,
  Columns extends readonly (keyof FromScope)[],
> = Expand<Source & Pick<FromScope, Columns[number]>>;

export type ExtractScopeFields<T extends Record<string, Expression<ScopeField>>> = {
  [K in keyof T]: T[K] extends Expression<infer F extends ScopeField> ? F : never;
};

export type FieldProxy<AvailableScope extends Scope> = {
  [K in keyof AvailableScope['topLevel']]: Expression<AvailableScope['topLevel'][K]>;
} & {
  [TableName in keyof AvailableScope['namespaces']]: {
    [K in keyof AvailableScope['namespaces'][TableName]]: Expression<
      AvailableScope['namespaces'][TableName][K]
    >;
  };
};

export type ExpressionBuilder<AvailableScope extends Scope, QC extends QueryContext> = (
  fields: FieldProxy<AvailableScope>,
  fns: Functions<QC>,
) => Expression<BooleanCodecType>;

export type OrderByDirection = 'asc' | 'desc';
export type OrderByNulls = 'first' | 'last';

export type OrderByOptions = {
  direction?: OrderByDirection;
  nulls?: OrderByNulls;
};

export type OrderByScope<
  AvailableScope extends Scope,
  RowType extends Record<string, ScopeField>,
> = {
  topLevel: Expand<AvailableScope['topLevel'] & RowType>;
  namespaces: AvailableScope['namespaces'];
};

type DeriveExtFunctions<OT extends QueryOperationTypesBase> = {
  [K in keyof OT]: OT[K]['impl'];
};

export type BuiltinFunctions<CT extends Record<string, { readonly input: unknown }>> = {
  eq: <CodecId extends string>(
    a: CodecExpression<CodecId, boolean, CT> | null,
    b: CodecExpression<CodecId, boolean, CT> | null,
  ) => Expression<BooleanCodecType>;
  ne: <CodecId extends string, N extends boolean>(
    a: CodecExpression<CodecId, N, CT> | null,
    b: CodecExpression<CodecId, N, CT> | null,
  ) => Expression<BooleanCodecType>;
  gt: <CodecId extends string, N extends boolean>(
    a: CodecExpression<CodecId, N, CT>,
    b: CodecExpression<CodecId, N, CT>,
  ) => Expression<BooleanCodecType>;
  gte: <CodecId extends string, N extends boolean>(
    a: CodecExpression<CodecId, N, CT>,
    b: CodecExpression<CodecId, N, CT>,
  ) => Expression<BooleanCodecType>;
  lt: <CodecId extends string, N extends boolean>(
    a: CodecExpression<CodecId, N, CT>,
    b: CodecExpression<CodecId, N, CT>,
  ) => Expression<BooleanCodecType>;
  lte: <CodecId extends string, N extends boolean>(
    a: CodecExpression<CodecId, N, CT>,
    b: CodecExpression<CodecId, N, CT>,
  ) => Expression<BooleanCodecType>;
  and: (...ands: CodecExpression<'pg/bool@1', boolean, CT>[]) => Expression<BooleanCodecType>;
  or: (...ors: CodecExpression<'pg/bool@1', boolean, CT>[]) => Expression<BooleanCodecType>;

  exists: (subquery: Subquery<Record<string, ScopeField>>) => Expression<BooleanCodecType>;
  notExists: (subquery: Subquery<Record<string, ScopeField>>) => Expression<BooleanCodecType>;

  in: {
    <CodecId extends string>(
      expr: Expression<{ codecId: CodecId; nullable: boolean }>,
      subquery: Subquery<Record<string, { codecId: CodecId; nullable: boolean }>>,
    ): Expression<BooleanCodecType>;
    <CodecId extends string>(
      expr: Expression<{ codecId: CodecId; nullable: boolean }>,
      values: Array<CodecExpression<CodecId, boolean, CT>>,
    ): Expression<BooleanCodecType>;
  };

  notIn: {
    <CodecId extends string>(
      expr: Expression<{ codecId: CodecId; nullable: boolean }>,
      subquery: Subquery<Record<string, { codecId: CodecId; nullable: boolean }>>,
    ): Expression<BooleanCodecType>;
    <CodecId extends string>(
      expr: Expression<{ codecId: CodecId; nullable: boolean }>,
      values: Array<CodecExpression<CodecId, boolean, CT>>,
    ): Expression<BooleanCodecType>;
  };

  readonly raw: RawSqlTag;
};

export type Functions<QC extends QueryContext> = BuiltinFunctions<QC['codecTypes']> &
  DeriveExtFunctions<QC['queryOperationTypes']>;

/**
 * The field an aggregate produces, read from the contract's emitted aggregate map.
 *
 * The map is settled per input codec at emit time, so this is two lookups: the
 * row for the input's codec, else the row that answers any input; and for a call
 * with no input, the row for that. What a target widens, preserves, or renames
 * is its own answer — this states it rather than restating the input.
 */
type AggregateField<QC extends QueryContext, Op extends string, InputCodecId> =
  AggregateRow<QC, Op, InputCodecId> extends {
    readonly output: infer Output extends string;
    readonly nullable: infer Nullable extends boolean;
  }
    ? { codecId: Output; nullable: Nullable }
    : ScopeField;

type AggregateRow<
  QC extends QueryContext,
  Op extends string,
  InputCodecId,
> = Op extends keyof QC['aggregateTypes']
  ? [InputCodecId] extends [never]
    ? WithoutInputRow<QC['aggregateTypes'][Op]>
    : InputCodecId extends keyof ByCodecRows<QC['aggregateTypes'][Op]>
      ? ByCodecRows<QC['aggregateTypes'][Op]>[InputCodecId]
      : AnyInputRow<QC['aggregateTypes'][Op]>
  : never;

type ByCodecRows<Operation> = Operation extends { readonly byCodec: infer Rows } ? Rows : never;
type AnyInputRow<Operation> = Operation extends { readonly anyInput: infer Row } ? Row : never;
type WithoutInputRow<Operation> = Operation extends { readonly withoutInput: infer Row }
  ? Row
  : never;

/**
 * A count reads through the codec its target declares for it. Both built-in
 * targets count into a 64-bit integer, so the application value is a `bigint`
 * either way — but which codec carries it is the contract's to say.
 */
export type CountField<QC extends QueryContext> = AggregateField<QC, 'count', never>;

declare const aggregateUnavailable: unique symbol;

/**
 * The impossible operand an aggregate call demands when the contract's
 * aggregate map declares no row for the operation and input. Intersecting it
 * with the operand type turns an undeclared pair into a call-site type error
 * that names the reason, instead of an expression whose runtime value the
 * target never declared.
 */
export interface AggregateUnavailable<Op extends string> {
  readonly [aggregateUnavailable]: `the composed target declares no '${Op}' aggregate for this input`;
}

type AggregateOperand<
  QC extends QueryContext,
  Op extends string,
  T extends ScopeField,
> = Expression<T> &
  (AggregateRow<QC, Op, T['codecId']> extends never ? AggregateUnavailable<Op> : unknown);

export type AggregateOnlyFunctions<QC extends QueryContext> = {
  // Two overloads because the runtime resolves them through different rows:
  // `count()` through `withoutInput`, `count(expr)` through `byCodec[input] ?? anyInput`.
  count: {
    (
      ...args: AggregateRow<QC, 'count', never> extends never ? [AggregateUnavailable<'count'>] : []
    ): Expression<CountField<QC>>;
    <T extends ScopeField>(
      expr: AggregateOperand<QC, 'count', T>,
    ): Expression<AggregateField<QC, 'count', T['codecId']>>;
  };
  sum: <T extends ScopeField>(
    expr: AggregateOperand<QC, 'sum', T>,
  ) => Expression<AggregateField<QC, 'sum', T['codecId']>>;
  avg: <T extends ScopeField>(
    expr: AggregateOperand<QC, 'avg', T>,
  ) => Expression<AggregateField<QC, 'avg', T['codecId']>>;
  min: <T extends ScopeField>(
    expr: AggregateOperand<QC, 'min', T>,
  ) => Expression<AggregateField<QC, 'min', T['codecId']>>;
  max: <T extends ScopeField>(
    expr: AggregateOperand<QC, 'max', T>,
  ) => Expression<AggregateField<QC, 'max', T['codecId']>>;
};

export type AggregateFunctions<QC extends QueryContext> = Functions<QC> &
  AggregateOnlyFunctions<QC>;
