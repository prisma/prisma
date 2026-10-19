import { dataType } from '@internal/framework-components/codec';
import { describe, expect, it } from 'vitest';
import { SqlColumnDefaultIR } from '../src/ir/sql-column-default-ir';
import type { SqlColumnIRInput } from '../src/ir/sql-column-ir';
import { SqlColumnIR } from '../src/ir/sql-column-ir';

describe('SqlColumnIR', () => {
  it('id is the column name, prefixed by kind', () => {
    const column = new SqlColumnIR({ name: 'email', nativeType: 'text', nullable: false });
    expect(column.id).toBe('column:email');
  });

  describe('children', () => {
    it('empty when the column has no default', () => {
      const column = new SqlColumnIR({ name: 'email', nativeType: 'text', nullable: false });
      expect(column.children()).toEqual([]);
    });

    it('yields a default node built from the resolved default', () => {
      const column = new SqlColumnIR({
        name: 'status',
        nativeType: 'text',
        nullable: false,
        resolvedNativeType: 'text',
        resolvedDefault: { kind: 'literal', value: 'draft' },
      });
      expect(column.children()).toEqual([
        new SqlColumnDefaultIR({
          resolved: { kind: 'literal', value: 'draft' },
        }),
      ]);
    });

    it('gives the default node the column codec identity, for rendering the default as DDL', () => {
      const codecRef = { codecId: 'pg/enum@1', typeParams: { typeName: 'order' }, many: true };
      const column = new SqlColumnIR({
        name: 'orders',
        nativeType: 'order',
        nullable: true,
        many: true,
        resolvedNativeType: 'order[]',
        resolvedDefault: { kind: 'literal', value: ['asc'] },
        codecRef,
        codecBaseNativeType: 'order',
      });

      const defaultNode = column.children()[0] as SqlColumnDefaultIR;

      expect(defaultNode).toBeInstanceOf(SqlColumnDefaultIR);
      expect({
        codecRef: defaultNode.codecRef,
        codecBaseNativeType: defaultNode.codecBaseNativeType,
        enumerableKeys: Object.keys(defaultNode),
      }).toEqual({
        codecRef,
        codecBaseNativeType: 'order',
        enumerableKeys: ['nodeKind', 'resolved'],
      });
    });

    it('gives the default node the value read for it, or why it could not be read', () => {
      const value = dataType('t/text', { read: (json) => json }).fromContract('draft', {});
      const node = (input: Partial<SqlColumnIRInput>) =>
        new SqlColumnIR({
          name: 'status',
          nativeType: 'text',
          nullable: false,
          ...input,
        }).children()[0] as SqlColumnDefaultIR;
      const read = node({
        resolvedDefault: { kind: 'literal', value: 'draft' },
        defaultValue: value,
      });
      const unread = node({ default: "'draft'::text", defaultUnreadable: 'refused' });
      expect({ value: read.value, unreadable: unread.unreadable }).toEqual({
        value,
        unreadable: 'refused',
      });
    });

    it('yields a default node from a raw default alone (unparseable or hand-built)', () => {
      const column = new SqlColumnIR({
        name: 'status',
        nativeType: 'text',
        nullable: false,
        default: "'draft'::text",
      });
      expect(column.children()).toEqual([new SqlColumnDefaultIR({ raw: "'draft'::text" })]);
    });
  });

  describe('isEqualTo (own attributes only — never the default)', () => {
    const text = dataType('t/text', { read: (json) => json });
    const numeric = dataType('t/numeric', { read: (json) => json });
    const varchar = dataType('t/varchar', { read: (json) => json });
    const reported = (text: string) => ({
      text,
      kind: undefined,
      schema: undefined,
      name: undefined,
    });
    const column = (input: Partial<SqlColumnIRInput> = {}) =>
      new SqlColumnIR({
        name: 'c',
        nativeType: 'text',
        nullable: false,
        storedType: text,
        typeParams: {},
        ...input,
      });

    it('true for one stored type, equal parameters, list flag and nullability, even when defaults differ', () => {
      expect(column({ default: "'x'" }).isEqualTo(column({ default: "'y'" }))).toBe(true);
    });

    it('true when the type texts differ but the stored types and parameters are equal', () => {
      const contract = column({
        nativeType: 'character varying(20)',
        resolvedNativeType: 'character varying(20)',
        storedType: varchar,
        typeParams: { length: 20 },
      });
      const database = column({
        nativeType: 'varchar(20)',
        resolvedNativeType: 'varchar(20)',
        storedType: varchar,
        typeParams: { length: 20 },
        reportedType: reported('varchar(20)'),
      });
      expect(contract.isEqualTo(database)).toBe(true);
    });

    it('compares parameters as canonical JSON', () => {
      const a = column({ storedType: numeric, typeParams: { precision: 10, scale: 0 } });
      const b = column({ storedType: numeric, typeParams: { scale: 0, precision: 10 } });
      const c = column({ storedType: numeric, typeParams: { precision: 10, scale: 2 } });
      expect({ same: a.isEqualTo(b), other: a.isEqualTo(c) }).toEqual({ same: true, other: false });
    });

    it('false when the stored types differ, even when the type texts are equal', () => {
      expect(column({ storedType: text }).isEqualTo(column({ storedType: varchar }))).toBe(false);
    });

    it('false when one is a list and the other is not', () => {
      expect(column({ many: true }).isEqualTo(column())).toBe(false);
    });

    it('false when nullable differs', () => {
      expect(column().isEqualTo(column({ nullable: true }))).toBe(false);
    });

    it('false when either side has no stored type, even against itself', () => {
      const unclaimed = new SqlColumnIR({ name: 'c', nativeType: 'hstore', nullable: false });
      expect({
        self: unclaimed.isEqualTo(unclaimed),
        againstTyped: column().isEqualTo(unclaimed),
      }).toEqual({ self: false, againstTyped: false });
    });
  });

  describe('explainMismatch (this = expected)', () => {
    const text = dataType('t/text', { read: (json) => json });
    const int4 = dataType('t/int4', { read: (json) => json });
    const column = (input: Partial<SqlColumnIRInput> = {}) =>
      new SqlColumnIR({
        name: 'c',
        nativeType: 'text',
        nullable: false,
        storedType: text,
        typeParams: {},
        ...input,
      });

    it('names the type the database reports, with [] for a list', () => {
      const database = column({
        nativeType: 'int4',
        storedType: int4,
        many: true,
        reportedType: { text: 'integer', kind: undefined, schema: 'pg_catalog', name: 'int4' },
      });
      expect(column({ many: true }).explainMismatch(database)).toBe(
        'The contract column is "text[]" and the database column is "integer[]".',
      );
    });

    it('names the type an unclaimed database column reports', () => {
      const database = new SqlColumnIR({
        name: 'c',
        nativeType: 'hstore',
        nullable: false,
        reportedType: { text: 'hstore', kind: undefined, schema: 'public', name: 'hstore' },
      });
      expect(column().explainMismatch(database)).toBe(
        'The database column is "hstore", which no data type in the configured stack declares.',
      );
    });

    it('names the other column type in a comparison of two contracts', () => {
      expect(column().explainMismatch(column({ nativeType: 'int4', storedType: int4 }))).toBe(
        'The contract column is "text" and the database column is "int4".',
      );
    });

    it('says which side is nullable when only nullability differs', () => {
      expect(column().explainMismatch(column({ nullable: true }))).toBe(
        'The contract column is not nullable and the database column is nullable.',
      );
    });
  });

  describe('resolved fields', () => {
    it('carries resolvedNativeType and resolvedDefault when supplied', () => {
      const column = new SqlColumnIR({
        name: 'email',
        nativeType: 'character varying(255)',
        nullable: false,
        resolvedNativeType: 'character varying(255)',
        resolvedDefault: { kind: 'literal', value: 'x' },
      });
      expect(column.resolvedNativeType).toBe('character varying(255)');
      expect(column.resolvedDefault).toEqual({ kind: 'literal', value: 'x' });
    });
  });

  describe('reportedType', () => {
    const reportedType = {
      text: 'numeric(10,2)',
      kind: undefined,
      schema: 'pg_catalog',
      name: 'numeric',
    };

    it('carries the type the database reports, outside JSON and equality', () => {
      const numeric = dataType('t/numeric', { read: (json) => json });
      const typed = { storedType: numeric, typeParams: {} };
      const column = new SqlColumnIR({
        name: 'price',
        nativeType: 'numeric',
        nullable: false,
        ...typed,
        reportedType,
      });
      const bare = new SqlColumnIR({
        name: 'price',
        nativeType: 'numeric',
        nullable: false,
        ...typed,
      });

      expect({
        reportedType: column.reportedType,
        json: JSON.stringify(column),
        equal: column.isEqualTo(bare),
      }).toEqual({ reportedType, json: JSON.stringify(bare), equal: true });
    });
  });

  describe('data type and parameters', () => {
    const numeric = dataType('t/numeric', { read: (json) => json });

    it('carries the data type, stored type and parameters outside JSON', () => {
      const column = new SqlColumnIR({
        name: 'price',
        nativeType: 'numeric',
        nullable: false,
        dataType: numeric,
        storedType: numeric,
        typeParams: { precision: 10, scale: 0 },
      });
      const bare = new SqlColumnIR({ name: 'price', nativeType: 'numeric', nullable: false });

      expect({
        dataType: column.dataType,
        storedType: column.storedType,
        typeParams: column.typeParams,
        json: JSON.stringify(column),
      }).toEqual({
        dataType: numeric,
        storedType: numeric,
        typeParams: { precision: 10, scale: 0 },
        json: JSON.stringify(bare),
      });
    });
  });

  describe('identity columns (introspected, no raw default)', () => {
    it('yields a default child node from resolvedDefault alone, with no raw default', () => {
      // A `GENERATED ... AS IDENTITY` column has no `column_default` at
      // all — the postgres control adapter sets `resolvedDefault` directly
      // to `autoincrement()` without a raw expression to parse, so
      // `children()` must still produce a default node without a `default`
      // (raw) field.
      const column = new SqlColumnIR({
        name: 'id',
        nativeType: 'int4',
        nullable: false,
        resolvedDefault: { kind: 'function', expression: 'autoincrement()' },
      });
      expect(column.children()).toEqual([
        new SqlColumnDefaultIR({
          resolved: { kind: 'function', expression: 'autoincrement()' },
        }),
      ]);
    });
  });
});
