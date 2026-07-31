import type { UNBOUND_DOMAIN_NAMESPACE_ID } from '@internal/contract/types';
import { describe, expectTypeOf, it } from 'vitest';
import type { CodecTypesOf, FieldInputTypesOf, FieldOutputTypesOf, TypeMaps } from '../src/types';

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
