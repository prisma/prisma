import type { UNBOUND_DOMAIN_NAMESPACE_ID } from '@internal/contract/types';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  AggregateTypesOf,
  CodecTypesOf,
  FieldInputTypesOf,
  FieldOutputTypesOf,
  TypeMaps,
} from '../src/types';

type NamespacedUser<TFields> = Record<
  typeof UNBOUND_DOMAIN_NAMESPACE_ID,
  { readonly User: TFields }
>;

describe('Contract and TypeMaps shape', () => {
  describe('TypeMaps shape', () => {
    it('TypeMaps has locked shape with codecTypes', () => {
      type TM = TypeMaps<{ 'pg/text@1': { output: string } }>;
      expectTypeOf<TM>().toExtend<{ readonly codecTypes: unknown }>();
    });

    it('CodecTypesOf extracts codecTypes from TypeMaps', () => {
      type TM = TypeMaps<{ foo: { output: number } }>;
      type CT = CodecTypesOf<TM>;
      expectTypeOf<CT>().toEqualTypeOf<{ foo: { output: number } }>();
    });

    it('TypeMaps accepts 4th TFieldInputTypes parameter', () => {
      type TM = TypeMaps<
        Record<string, never>,
        Record<string, never>,
        Record<string, never>,
        NamespacedUser<{ name: string }>
      >;
      expectTypeOf<TM>().toExtend<{ readonly fieldInputTypes: unknown }>();
    });

    it('TypeMaps defaults TFieldInputTypes to Record<string, never>', () => {
      type TM = TypeMaps;
      type FIT = FieldInputTypesOf<TM>;
      expectTypeOf<FIT>().toEqualTypeOf<Record<string, never>>();
    });

    it('FieldOutputTypesOf extracts fieldOutputTypes from TypeMaps', () => {
      type TM = TypeMaps<
        Record<string, never>,
        Record<string, never>,
        NamespacedUser<{ name: string }>
      >;
      type FOT = FieldOutputTypesOf<TM>;
      expectTypeOf<FOT>().toEqualTypeOf<NamespacedUser<{ name: string }>>();
    });

    it('FieldInputTypesOf extracts fieldInputTypes from TypeMaps', () => {
      type TM = TypeMaps<
        Record<string, never>,
        Record<string, never>,
        Record<string, never>,
        NamespacedUser<{ name: string }>
      >;
      type FIT = FieldInputTypesOf<TM>;
      expectTypeOf<FIT>().toEqualTypeOf<NamespacedUser<{ name: string }>>();
    });
  });
});

describe('TypeMaps aggregateTypes', () => {
  type PgAggregates = {
    readonly count: {
      readonly byCodec: Record<string, never>;
      readonly withoutInput: { readonly output: 'pg/int8@1'; readonly nullable: false };
      readonly anyInput: { readonly output: 'pg/int8@1'; readonly nullable: false };
    };
    readonly min: {
      readonly byCodec: {
        readonly 'pg/varchar@1': { readonly output: 'pg/text@1'; readonly nullable: true };
        readonly 'pg/char@1': { readonly output: 'pg/char@1'; readonly nullable: true };
      };
    };
  };

  type TM = TypeMaps<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    PgAggregates
  >;

  it('TypeMaps accepts 7th TAggregateTypes parameter', () => {
    expectTypeOf<TM>().toExtend<{ readonly aggregateTypes: unknown }>();
  });

  it('AggregateTypesOf extracts aggregateTypes from TypeMaps', () => {
    expectTypeOf<AggregateTypesOf<TM>>().toEqualTypeOf<PgAggregates>();
  });

  it('TypeMaps defaults TAggregateTypes to Record<string, never>', () => {
    expectTypeOf<AggregateTypesOf<TypeMaps>>().toEqualTypeOf<Record<string, never>>();
  });

  // What a result-type resolver walks: the exact overload's row and the row the
  // trait fallback settled are both present and differ, so the resolver reads
  // one answer per codec rather than re-deciding precedence.
  it('distinguishes an exact overload from the trait fallback that would otherwise serve the codec', () => {
    type Min = AggregateTypesOf<TM>['min']['byCodec'];
    expectTypeOf<Min['pg/varchar@1']['output']>().toEqualTypeOf<'pg/text@1'>();
    expectTypeOf<Min['pg/char@1']['output']>().toEqualTypeOf<'pg/char@1'>();
  });

  it('carries an input-agnostic row an input-specific lookup can fall back to', () => {
    type Count = AggregateTypesOf<TM>['count'];
    expectTypeOf<Count['anyInput']['output']>().toEqualTypeOf<'pg/int8@1'>();
    expectTypeOf<Count['withoutInput']['nullable']>().toEqualTypeOf<false>();
  });
});
