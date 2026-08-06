import type { JsonValue, PlanMeta } from '@internal/contract/types';
import type { AnyQueryAst, LoweredParam } from '@internal/sql-relational-core/ast';
import type {
  CodecTypesBase,
  CodecValue,
  Expression,
} from '@internal/sql-relational-core/expression';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';

export type ParamSpec<CT extends CodecTypesBase = CodecTypesBase> =
  | (keyof CT & string)
  | {
      readonly codecId: keyof CT & string;
      readonly typeParams?: JsonValue;
      readonly nullable?: boolean;
    };

export type Declaration<CT extends CodecTypesBase = CodecTypesBase> = Readonly<
  Record<string, ParamSpec<CT>>
>;

export type DeclaredCodecId<S> = S extends string
  ? S
  : S extends { readonly codecId: infer C extends string }
    ? C
    : never;

export type DeclaredNullable<S> = S extends { readonly nullable: true } ? true : false;

export type BindSiteParams<D> = {
  readonly [K in keyof D]: Expression<{
    codecId: DeclaredCodecId<D[K]>;
    nullable: DeclaredNullable<D[K]>;
  }>;
};

export type ParamsFromDeclaration<D, CT extends CodecTypesBase> = {
  readonly [K in keyof D]: CodecValue<DeclaredCodecId<D[K]>, DeclaredNullable<D[K]>, CT>;
};

export type PrepareCallback<D, Row> = (params: BindSiteParams<D>) => SqlQueryPlan<Row>;

export interface PreparedStatement<Params, Row> {
  readonly sql: string;
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
  readonly slots: readonly LoweredParam[];
  readonly _params?: Params;
  readonly _row?: Row;
}
