import { describe, expect, it } from 'vitest';
import { PG_ENUM_CODEC_ID } from '../src/core/codec-ids';
import { pgEnumDescriptor } from '../src/core/codecs';

describe('PgEnumDescriptor (pg/enum@1) as a parameterized codec', () => {
  it('is parameterized with a { typeName: string } params schema', async () => {
    expect(pgEnumDescriptor.isParameterized).toBe(true);

    const valid = await pgEnumDescriptor.paramsSchema['~standard'].validate({
      typeName: 'auth.aal_level',
    });
    expect(valid).toMatchObject({ value: { typeName: 'auth.aal_level' } });

    const invalid = await pgEnumDescriptor.paramsSchema['~standard'].validate({ typeName: 42 });
    expect(invalid).toHaveProperty('issues');
  });

  describe('nativeTypeFor', () => {
    it('derives the native type from the codec-instance typeParams', () => {
      expect(
        pgEnumDescriptor.nativeTypeFor({
          codecId: PG_ENUM_CODEC_ID,
          typeParams: { typeName: 'aal_level' },
        }),
      ).toBe('aal_level');
      expect(
        pgEnumDescriptor.nativeTypeFor({
          codecId: PG_ENUM_CODEC_ID,
          typeParams: { typeName: 'auth.aal_level' },
        }),
      ).toBe('auth.aal_level');
    });

    // Stricter than the metadata channel this replaced, which answered with a
    // static `text` for params it could not read. An enum column whose params
    // do not carry a type name has no native type, and saying so is better than
    // naming one it does not have — the contract boundary rejects such a column
    // long before rendering, so nothing reachable relied on the fallback.
    it.each([undefined, null, 'aal_level', ['aal_level'], { typeName: 42 }, {}])(
      'rejects typeParams it cannot read a type name from: %s',
      (typeParams) => {
        expect(() =>
          pgEnumDescriptor.nativeTypeFor({
            codecId: PG_ENUM_CODEC_ID,
            typeParams: typeParams as never,
          }),
        ).toThrow();
      },
    );
  });
});
