import type { ExtractCodecTypes } from '@internal/sql-contract/types';
import { describe, expectTypeOf, test } from 'vitest';
import type { CodecField, CollectionModelName, ModelAccessor } from '../src/types';
import type { TestContract } from './helpers';

type Exactly<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type ModelName = CollectionModelName<TestContract>;
type Accessor<M extends ModelName> = ModelAccessor<TestContract, M, 'public'>;

type ScalarFieldName<M extends ModelName> = {
  [F in keyof Accessor<M> & string]: Accessor<M>[F] extends { readonly returnType: unknown }
    ? F
    : never;
}[keyof Accessor<M> & string];

type CodecFieldOf<Field> = Field extends {
  readonly returnType: {
    readonly codecId: infer Id extends keyof ExtractCodecTypes<TestContract> & string;
    readonly nullable: infer Nullable extends boolean;
  };
}
  ? CodecField<TestContract, Id, Nullable>
  : never;

type MethodName<Field> = Exclude<keyof Field & string, 'returnType' | 'buildAst'>;

type MethodDifferences<Path extends string, Field, Codec> = {
  [K in MethodName<Field>]: K extends keyof Codec
    ? Field[K] extends (...args: infer FieldArgs) => unknown
      ? Codec[K] extends (...args: infer CodecArgs) => unknown
        ? Exactly<FieldArgs, CodecArgs> extends true
          ? never
          : `${Path}.${K}`
        : `${Path}.${K}`
      : never
    : `${Path}.${K}`;
}[MethodName<Field>];

type FieldDifferences<M extends ModelName> = {
  [F in ScalarFieldName<M>]: [CodecFieldOf<Accessor<M>[F]>] extends [never]
    ? never
    : Exactly<keyof Accessor<M>[F], keyof CodecFieldOf<Accessor<M>[F]>> extends true
      ? MethodDifferences<`${M}.${F}`, Accessor<M>[F], CodecFieldOf<Accessor<M>[F]>>
      : `${M}.${F} methods`;
}[ScalarFieldName<M>];

type FieldsWithoutCodecField<M extends ModelName> = {
  [F in ScalarFieldName<M>]: [CodecFieldOf<Accessor<M>[F]>] extends [never] ? `${M}.${F}` : never;
}[ScalarFieldName<M>];

type Differences = { [M in ModelName]: FieldDifferences<M> }[ModelName];

type ValueMethod = 'eq' | 'neq' | 'in' | 'notIn';
type RefinedValueMethods = `User.address.${ValueMethod}`;
type Unmatched = { [M in ModelName]: FieldsWithoutCodecField<M> }[ModelName];

describe('CodecField against every scalar field of the test contract', () => {
  test('the comparison checks fields, not nothing', () => {
    expectTypeOf<ScalarFieldName<'Post'>>().toEqualTypeOf<
      'id' | 'title' | 'userId' | 'views' | 'embedding'
    >();
  });

  test('every scalar field of the test contract has a CodecField', () => {
    expectTypeOf<Unmatched>().toBeNever();
  });

  test('every method takes the same parameters, except the value methods of a value-object field, whose input type refines its codec input', () => {
    expectTypeOf<Differences>().toEqualTypeOf<RefinedValueMethods>();
  });
});
