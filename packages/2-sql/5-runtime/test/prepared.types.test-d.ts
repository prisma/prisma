import type { CodecTypesBase, Expression } from '@internal/sql-relational-core/expression';
import { expectTypeOf, test } from 'vitest';
import type {
  BindSiteParams,
  Declaration,
  ParamsFromDeclaration,
  PrepareCallback,
  PreparedStatement,
  Runtime,
} from '../src/exports';

// A minimal codec-types stand-in mirroring the shape produced by
// `ExtractCodecTypes<TContract>` for a real contract. The intersection
// with `CodecTypesBase` mirrors the facade-level pattern that satisfies
// the `CT extends CodecTypesBase` constraint while keeping precise
// per-id input types.
type FixtureCT = {
  readonly 'pg/int4@1': { readonly input: number; readonly output: number };
  readonly 'pg/text@1': { readonly input: string; readonly output: string };
} & CodecTypesBase;

test('Declaration entries accept short and long forms', () => {
  type Decl = {
    readonly userId: 'pg/int4@1';
    readonly email: { readonly codecId: 'pg/text@1'; readonly nullable: true };
  };
  expectTypeOf<Decl>().toExtend<Declaration<FixtureCT>>();
});

test('Declaration long form accepts typeParams', () => {
  type Decl = {
    readonly items: {
      readonly codecId: 'pg/int4@1';
      readonly typeParams: { readonly item: 'pg/int4@1' };
    };
  };
  expectTypeOf<Decl>().toExtend<Declaration<FixtureCT>>();
});

test('BindSiteParams maps each declared name to an Expression<{codecId, nullable}>', () => {
  type Decl = {
    readonly userId: 'pg/int4@1';
    readonly email: { readonly codecId: 'pg/text@1'; readonly nullable: true };
  };
  type Params = BindSiteParams<Decl>;
  expectTypeOf<Params['userId']>().toEqualTypeOf<
    Expression<{ codecId: 'pg/int4@1'; nullable: false }>
  >();
  expectTypeOf<Params['email']>().toEqualTypeOf<
    Expression<{ codecId: 'pg/text@1'; nullable: true }>
  >();
});

test('ParamsFromDeclaration threads codec input types through', () => {
  type Decl = {
    readonly userId: 'pg/int4@1';
    readonly email: { readonly codecId: 'pg/text@1'; readonly nullable: true };
  };
  type Params = ParamsFromDeclaration<Decl, FixtureCT>;
  expectTypeOf<Params>().toEqualTypeOf<{
    readonly userId: number;
    readonly email: string | null;
  }>();
});

test('PreparedStatement.execute(target, params) is typed by the declaration', () => {
  type Decl = { readonly userId: 'pg/int4@1' };
  type Params = ParamsFromDeclaration<Decl, FixtureCT>;
  type Row = { readonly id: number };
  type PS = PreparedStatement<Params, Row>;

  const ps = {} as PS;
  const runtime = {} as Runtime;
  // Accepts the inferred params shape.
  ps.execute(runtime, { userId: 7 });
  // Row stream is typed.
  expectTypeOf(ps.execute(runtime, { userId: 7 })).toExtend<AsyncIterable<Row>>();
});

test('PreparedStatement.execute rejects mismatched param shapes', () => {
  type Decl = { readonly userId: 'pg/int4@1' };
  type Params = ParamsFromDeclaration<Decl, FixtureCT>;
  type PS = PreparedStatement<Params, { id: number }>;
  const ps = {} as PS;
  const runtime = {} as Runtime;

  // @ts-expect-error — userId must be number, not string
  ps.execute(runtime, { userId: 'not-a-number' });
  // @ts-expect-error — missing userId
  ps.execute(runtime, {});
  // @ts-expect-error — unknown key
  ps.execute(runtime, { userId: 1, extra: 2 });
});

test('PrepareCallback returns the plan whose Row drives the statement', () => {
  type Decl = { readonly userId: 'pg/int4@1' };
  type Cb = PrepareCallback<Decl, { id: number }>;
  // Callback receives the bind-site params and returns a plan with Row inferred.
  const fn = ((_params) => ({}) as never) as Cb;
  void fn;
});
