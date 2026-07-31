import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { SqlCheckConstraintIR } from '@internal/sql-schema-ir/types';
import { describe, expect, it } from 'vitest';
import { createPostgresBuiltinCodecLookup } from '../src/core/codec-lookup';
import { PostgresControlAdapter, parseCheckConstraintDef } from '../src/core/control-adapter';

// ---------------------------------------------------------------------------
// parseCheckConstraintDef unit tests
// ---------------------------------------------------------------------------

describe('parseCheckConstraintDef', () => {
  it('parses = ANY (ARRAY[...]) shape — Postgres internal rewrite of IN (...)', () => {
    const result = parseCheckConstraintDef(
      "CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))",
    );
    expect(result).toEqual({ column: 'status', permittedValues: ['active', 'inactive'] });
  });

  it('parses = ANY (ARRAY[...]) with a single value', () => {
    const result = parseCheckConstraintDef("CHECK ((role = ANY (ARRAY['admin'::text])))");
    expect(result).toEqual({ column: 'role', permittedValues: ['admin'] });
  });

  it('parses IN (...) shape', () => {
    const result = parseCheckConstraintDef("CHECK ((status IN ('draft', 'published')))");
    expect(result).toEqual({ column: 'status', permittedValues: ['draft', 'published'] });
  });

  it('strips casts like ::character varying from array literals', () => {
    const result = parseCheckConstraintDef(
      "CHECK ((color = ANY (ARRAY['red'::character varying, 'blue'::character varying])))",
    );
    expect(result).toEqual({ column: 'color', permittedValues: ['red', 'blue'] });
  });

  it('returns undefined for a free-form predicate it cannot parse', () => {
    const result = parseCheckConstraintDef('CHECK ((price > 0))');
    expect(result).toBeUndefined();
  });

  it('returns undefined for an IS NOT NULL check', () => {
    const result = parseCheckConstraintDef('CHECK ((col IS NOT NULL))');
    expect(result).toBeUndefined();
  });

  // F1: doubled single-quote un-escaping
  it("un-escapes doubled single-quotes in ARRAY values (O''Brien → O'Brien)", () => {
    const result = parseCheckConstraintDef(
      "CHECK ((last_name = ANY (ARRAY['O''Brien'::text, 'Smith'::text])))",
    );
    expect(result).toEqual({ column: 'last_name', permittedValues: ["O'Brien", 'Smith'] });
  });

  it('un-escapes doubled single-quotes in IN list values', () => {
    const result = parseCheckConstraintDef("CHECK ((last_name IN ('O''Brien', 'Smith')))");
    expect(result).toEqual({ column: 'last_name', permittedValues: ["O'Brien", 'Smith'] });
  });

  // F2: double-quoted (non-identifier) column names
  it('parses a double-quoted column name in ARRAY shape', () => {
    const result = parseCheckConstraintDef(
      "CHECK ((\"my-col\" = ANY (ARRAY['a'::text, 'b'::text])))",
    );
    expect(result).toEqual({ column: 'my-col', permittedValues: ['a', 'b'] });
  });

  it('parses a double-quoted column name in IN shape', () => {
    const result = parseCheckConstraintDef("CHECK ((\"my-col\" IN ('a', 'b')))");
    expect(result).toEqual({ column: 'my-col', permittedValues: ['a', 'b'] });
  });

  // Composite predicates: must NOT match either shape
  it('returns undefined for a composite predicate with IN and AND (= ANY shape)', () => {
    const result = parseCheckConstraintDef(
      "CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]) AND amount > 0))",
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for a composite predicate with IN and AND (IN shape)', () => {
    const result = parseCheckConstraintDef(
      "CHECK ((status IN ('draft', 'published') AND amount > 0))",
    );
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PostgresControlAdapter.introspect — check constraint round-trip
// ---------------------------------------------------------------------------

describe('PostgresControlAdapter.introspect — check constraints', () => {
  it('introspects a table with a check constraint and parses the value set', async () => {
    const adapter = new PostgresControlAdapter(createPostgresBuiltinCodecLookup());
    const mockDriver: SqlControlDriverInstance<'postgres'> = {
      familyId: 'sql',
      targetId: 'postgres',
      query: async <Row = Record<string, unknown>>(sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'post' }] as unknown as Row[] };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              {
                table_name: 'post',
                column_name: 'status',
                data_type: 'text',
                udt_name: 'text',
                is_nullable: 'NO',
                character_maximum_length: null,
                numeric_precision: null,
                numeric_scale: null,
                column_default: null,
                formatted_type: null,
              },
            ] as unknown as Row[],
          };
        }
        if (sql.includes('pg_constraint') && sql.includes("contype = 'c'")) {
          return {
            rows: [
              {
                table_name: 'post',
                constraint_name: 'post_status_check',
                constraintdef: "CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))",
              },
            ] as unknown as Row[],
          };
        }
        return { rows: [] as unknown as Row[] };
      },
      close: async () => {},
    };

    const result = await adapter.introspect(mockDriver);

    expect(Object.values(result.namespaces)[0]?.tables['post']?.checks).toEqual([
      new SqlCheckConstraintIR({
        name: 'post_status_check',
        column: 'status',
        permittedValues: ['draft', 'published'],
      }),
    ]);
  });

  it('skips free-form check constraints it cannot parse', async () => {
    const adapter = new PostgresControlAdapter(createPostgresBuiltinCodecLookup());
    const mockDriver: SqlControlDriverInstance<'postgres'> = {
      familyId: 'sql',
      targetId: 'postgres',
      query: async <Row = Record<string, unknown>>(sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'order' }] as unknown as Row[] };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              {
                table_name: 'order',
                column_name: 'amount',
                data_type: 'numeric',
                udt_name: 'numeric',
                is_nullable: 'NO',
                character_maximum_length: null,
                numeric_precision: 10,
                numeric_scale: 2,
                column_default: null,
                formatted_type: null,
              },
            ] as unknown as Row[],
          };
        }
        if (sql.includes('pg_constraint') && sql.includes("contype = 'c'")) {
          return {
            rows: [
              {
                table_name: 'order',
                constraint_name: 'positive_amount',
                constraintdef: 'CHECK ((amount > (0)::numeric))',
              },
            ] as unknown as Row[],
          };
        }
        return { rows: [] as unknown as Row[] };
      },
      close: async () => {},
    };

    const result = await adapter.introspect(mockDriver);

    // The free-form CHECK predicate is silently skipped
    expect(Object.values(result.namespaces)[0]?.tables['order']?.checks).toBeUndefined();
  });

  it('does not add checks property when table has no check constraints', async () => {
    const adapter = new PostgresControlAdapter(createPostgresBuiltinCodecLookup());
    const mockDriver: SqlControlDriverInstance<'postgres'> = {
      familyId: 'sql',
      targetId: 'postgres',
      query: async <Row = Record<string, unknown>>(sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'user' }] as unknown as Row[] };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              {
                table_name: 'user',
                column_name: 'id',
                data_type: 'integer',
                udt_name: 'int4',
                is_nullable: 'NO',
                character_maximum_length: null,
                numeric_precision: null,
                numeric_scale: null,
                column_default: null,
                formatted_type: null,
              },
            ] as unknown as Row[],
          };
        }
        return { rows: [] as unknown as Row[] };
      },
      close: async () => {},
    };

    const result = await adapter.introspect(mockDriver);

    expect(Object.values(result.namespaces)[0]?.tables['user']?.checks).toBeUndefined();
  });
});
