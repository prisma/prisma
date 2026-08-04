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

export type CountField = { codecId: 'pg/int8@1'; nullable: false };

export type AggregateOnlyFunctions = {
  count: (expr?: Expression<ScopeField>) => Expression<CountField>;
  sum: <T extends ScopeField>(
    expr: Expression<T>,
  ) => Expression<{ codecId: T['codecId']; nullable: true }>;
  avg: <T extends ScopeField>(
    expr: Expression<T>,
  ) => Expression<{ codecId: T['codecId']; nullable: true }>;
  min: <T extends ScopeField>(
    expr: Expression<T>,
  ) => Expression<{ codecId: T['codecId']; nullable: true }>;
  max: <T extends ScopeField>(
    expr: Expression<T>,
  ) => Expression<{ codecId: T['codecId']; nullable: true }>;
};

export type AggregateFunctions<QC extends QueryContext> = Functions<QC> & AggregateOnlyFunctions;
