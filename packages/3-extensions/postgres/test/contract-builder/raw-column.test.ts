import { describe, expect, it } from 'vitest';
import { defineContract, type ScalarFieldBuilder, sql } from '../../src/exports/contract-builder';

type Helpers = Parameters<NonNullable<Parameters<typeof defineContract>[1]>>[0];

function shapeColumn(
  build: (field: Helpers['field'], type: Helpers['type']) => ScalarFieldBuilder,
) {
  const contract = defineContract({}, ({ field, model, type }) => ({
    models: {
      Shape: model('Shape', {
        fields: { id: field.id.uuidv4String(), area: build(field, type) },
      }),
    },
  }));
  return contract.storage.namespaces['public']?.entries.table?.['Shape']?.columns['area'];
}

describe('type.Raw in the Postgres contract builder', () => {
  it('declares a raw column with the text as its sql parameter', () => {
    expect(shapeColumn((field, type) => field.column(type.Raw('circle')))).toEqual({
      codecId: 'sql/raw@1',
      dataType: 'sql/raw',
      typeParams: { sql: 'circle' },
      nullable: false,
      many: false,
    });
  });

  it('accepts a sql default', () => {
    expect(
      shapeColumn((field, type) =>
        field.column(type.Raw('circle')).default(sql`'<(0,0),1>'::circle`),
      )?.default,
    ).toEqual({ kind: 'function', expression: "'<(0,0),1>'::circle" });
  });

  it('refuses a literal default, since its codec writes no value as JSON', () => {
    expect(() =>
      shapeColumn((field, type) => field.column(type.Raw('circle')).default('<(0,0),1>')),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        cause: expect.objectContaining({ code: 'RUNTIME.ENCODE_FAILED' }),
      }),
    );
  });
});
