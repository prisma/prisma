import { describe, expect, it } from 'vitest';
import { type CatalogColumnType, introspectedNativeType } from '../src/core/native-type-normalizer';

const column = (overrides: Partial<CatalogColumnType>): CatalogColumnType => ({
  formattedType: null,
  informationSchemaType: 'USER-DEFINED',
  udtName: '',
  characterMaximumLength: null,
  numericPrecision: null,
  numericScale: null,
  ...overrides,
});

describe('introspectedNativeType', () => {
  describe('from the type format_type reports', () => {
    it.each([
      {
        formattedType: 'integer',
        informationSchemaType: 'integer',
        udtName: 'int4',
      },
      {
        formattedType: 'bigint',
        informationSchemaType: 'bigint',
        udtName: 'int8',
      },
      {
        formattedType: 'boolean',
        informationSchemaType: 'boolean',
        udtName: 'bool',
      },
      {
        formattedType: 'double precision',
        informationSchemaType: 'double precision',
        udtName: 'float8',
      },
      {
        formattedType: 'character varying(10)',
        informationSchemaType: 'character varying',
        udtName: 'varchar',
      },
      {
        formattedType: 'numeric(10,2)',
        informationSchemaType: 'numeric',
        udtName: 'numeric',
      },
      {
        formattedType: 'timestamp(3) without time zone',
        informationSchemaType: 'timestamp without time zone',
        udtName: 'timestamp',
      },
      {
        formattedType: 'timestamp with time zone',
        informationSchemaType: 'timestamp with time zone',
        udtName: 'timestamptz',
      },
      {
        formattedType: 'audit."AuditAction"',
        informationSchemaType: 'USER-DEFINED',
        udtName: 'AuditAction',
      },
    ])('reads $formattedType as it is reported', (type) => {
      expect(introspectedNativeType(column(type))).toEqual({
        nativeType: type.formattedType,
        many: undefined,
      });
    });

    it.each([
      { formattedType: 'integer[]', udtName: '_int4', nativeType: 'integer' },
      { formattedType: 'character(3)[]', udtName: '_bpchar', nativeType: 'character(3)' },
      { formattedType: '"Role"[]', udtName: '_Role', nativeType: '"Role"' },
    ])(
      'reads the array $formattedType as a list of $nativeType',
      ({ formattedType, udtName, nativeType }) => {
        expect(
          introspectedNativeType(
            column({ formattedType, informationSchemaType: 'ARRAY', udtName }),
          ),
        ).toEqual({ nativeType, many: true });
      },
    );
  });

  describe('without a type from format_type', () => {
    it('adds the length to a character type', () => {
      expect(
        introspectedNativeType(
          column({
            informationSchemaType: 'character varying',
            udtName: 'varchar',
            characterMaximumLength: 10,
          }),
        ),
      ).toEqual({
        nativeType: 'character varying(10)',
        many: undefined,
      });
    });

    it('adds the precision and scale to a numeric type', () => {
      expect(
        introspectedNativeType(
          column({
            informationSchemaType: 'numeric',
            udtName: 'numeric',
            numericPrecision: 10,
            numericScale: 2,
          }),
        ),
      ).toEqual({
        nativeType: 'numeric(10,2)',
        many: undefined,
      });
    });

    it('falls back to the udt name', () => {
      expect(
        introspectedNativeType(column({ informationSchemaType: 'text', udtName: 'text' })),
      ).toEqual({
        nativeType: 'text',
        many: undefined,
      });
    });
  });
});
