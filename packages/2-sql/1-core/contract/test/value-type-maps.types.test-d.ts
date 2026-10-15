import type { ParameterizedOutputTypesFunction } from '@internal/contract/types';
import { describe, expectTypeOf, test } from 'vitest';
import type { ColumnTypesFromStorage, FieldTypesFromDomain } from '../src/exports/types';

type CodecTypes = {
  readonly 'test/text@1': { readonly input: string; readonly output: string };
  readonly 'test/char@1': { readonly input: string; readonly output: string };
  readonly 'test/json@1': { readonly input: unknown; readonly output: unknown };
};

type Char<N extends number> = string & { readonly __length: N };

type CharOutputTypeMap<TypeParams> = {
  readonly 'test/char@1': TypeParams extends { readonly length: infer N extends number }
    ? Char<N>
    : never;
};

interface CharOutputTypes extends ParameterizedOutputTypesFunction {
  readonly outputTypes: CharOutputTypeMap<this['typeParams']>;
}

type Domain = {
  readonly public: {
    readonly models: {
      readonly User: {
        readonly fields: {
          readonly id: {
            readonly nullable: false;
            readonly type: {
              readonly kind: 'scalar';
              readonly codecId: 'test/char@1';
              readonly typeParams: { readonly length: 24 };
            };
          };
          readonly mood: {
            readonly nullable: true;
            readonly type: { readonly kind: 'scalar'; readonly codecId: 'test/text@1' };
          };
          readonly tags: {
            readonly nullable: false;
            readonly type: { readonly kind: 'scalar'; readonly codecId: 'test/text@1' };
            readonly many: { readonly elementNullable: true };
          };
          readonly settings: {
            readonly nullable: false;
            readonly type: { readonly kind: 'scalar'; readonly codecId: 'test/json@1' };
          };
          readonly unknownCodec: {
            readonly nullable: false;
            readonly type: { readonly kind: 'scalar'; readonly codecId: 'test/missing@1' };
          };
        };
      };
      readonly Empty: { readonly fields: Record<never, never> };
    };
  };
};

type Known = {
  readonly public: {
    readonly User: {
      readonly mood: { readonly output: 'happy' | 'sad'; readonly input: 'happy' | 'sad' };
      readonly settings: { readonly output: { readonly theme: string } };
    };
  };
};

type Output = FieldTypesFromDomain<Domain, CodecTypes, CharOutputTypes, Known, 'output'>;
type Input = FieldTypesFromDomain<Domain, CodecTypes, CharOutputTypes, Known, 'input'>;

describe('field types from a contract domain', () => {
  test('a column with type parameters reads as the type its pack gives it, and writes as the codec input', () => {
    expectTypeOf<Output['public']['User']['id']>().toEqualTypeOf<Char<24>>();
    expectTypeOf<Input['public']['User']['id']>().toEqualTypeOf<string>();
  });

  test('a known type replaces the codec type on the sides it gives, before nullability', () => {
    expectTypeOf<Output['public']['User']['mood']>().toEqualTypeOf<'happy' | 'sad' | null>();
    expectTypeOf<Input['public']['User']['mood']>().toEqualTypeOf<'happy' | 'sad' | null>();
    expectTypeOf<Output['public']['User']['settings']>().toEqualTypeOf<{
      readonly theme: string;
    }>();
    expectTypeOf<Input['public']['User']['settings']>().toEqualTypeOf<unknown>();
  });

  test('a list wraps the element type, with null for nullable elements', () => {
    expectTypeOf<Output['public']['User']['tags']>().toEqualTypeOf<ReadonlyArray<string | null>>();
  });

  test('a codec the codec types lack reads as unknown', () => {
    expectTypeOf<Output['public']['User']['unknownCodec']>().toEqualTypeOf<unknown>();
  });

  test('a model without fields has open output types and closed input types', () => {
    expectTypeOf<Output['public']['Empty']>().toEqualTypeOf<Record<never, never>>();
    expectTypeOf<Input['public']['Empty']>().toEqualTypeOf<Record<string, never>>();
  });
});

type Storage = {
  readonly types: {
    readonly Code: {
      readonly codecId: 'test/char@1';
      readonly typeParams: { readonly length: 8 };
    };
  };
  readonly namespaces: {
    readonly public: {
      readonly entries: {
        readonly table: {
          readonly users: {
            readonly columns: {
              readonly id: {
                readonly codecId: 'test/char@1';
                readonly nullable: false;
                readonly typeParams: { readonly length: 24 };
                readonly many: false;
              };
              readonly code: {
                readonly codecId: 'test/char@1';
                readonly nullable: true;
                readonly typeRef: 'Code';
                readonly many: false;
              };
              readonly mood: {
                readonly codecId: 'test/text@1';
                readonly nullable: false;
                readonly many: false;
              };
            };
          };
        };
      };
    };
  };
};

type KnownColumns = {
  readonly public: {
    readonly users: {
      readonly mood: { readonly output: 'happy' | 'sad'; readonly input: 'happy' | 'sad' };
    };
  };
};

type ColumnOutput = ColumnTypesFromStorage<
  Storage,
  CodecTypes,
  CharOutputTypes,
  KnownColumns,
  'output'
>;

describe('storage column types from a contract storage', () => {
  test('a column takes its own type parameters, or those of its named type', () => {
    expectTypeOf<ColumnOutput['public']['users']['id']>().toEqualTypeOf<Char<24>>();
    expectTypeOf<ColumnOutput['public']['users']['code']>().toEqualTypeOf<Char<8> | null>();
  });

  test('a known type replaces the codec type', () => {
    expectTypeOf<ColumnOutput['public']['users']['mood']>().toEqualTypeOf<'happy' | 'sad'>();
  });
});
