import type { ToCanonicalForm } from '@internal/framework-components/codec';
import { diffSchemas } from '@internal/framework-components/control';
import { structuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';

import { SqlColumnDefaultIR } from '../src/ir/sql-column-default-ir';

describe('SqlColumnDefaultIR', () => {
  it('id is the fixed sentinel (one default per column)', () => {
    expect(new SqlColumnDefaultIR({ raw: "'x'" }).id).toBe('default');
  });

  it('nodeKind is the column-default kind', () => {
    expect(new SqlColumnDefaultIR({ raw: "'x'" }).nodeKind).toBe('sql-column-default');
  });

  it('children is empty (a default is a leaf)', () => {
    expect(new SqlColumnDefaultIR({ raw: "'x'" }).children()).toEqual([]);
  });

  describe('isEqualTo (this = expected)', () => {
    it('literal defaults compare structurally, ignoring raw strings', () => {
      const expected = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'draft' } });
      const actual = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: 'draft' },
        raw: "'draft'::text",
      });
      expect(expected.isEqualTo(actual)).toBe(true);
    });

    it('false when literal values differ', () => {
      const expected = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'draft' } });
      const actual = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'published' } });
      expect(expected.isEqualTo(actual)).toBe(false);
    });

    it('function expressions compare case- and whitespace-insensitively', () => {
      const expected = new SqlColumnDefaultIR({
        resolved: { kind: 'function', expression: 'NOW()' },
      });
      const actual = new SqlColumnDefaultIR({
        resolved: { kind: 'function', expression: 'now ()' },
      });
      expect(expected.isEqualTo(actual)).toBe(true);
    });

    it('a literal compares through the canonical form the contract-derived side carries', () => {
      const timestamptz: ToCanonicalForm = (value) =>
        typeof value === 'string'
          ? value.replace(' ', 'T').replace('.000Z', 'Z').replace('+00', 'Z')
          : value;
      const expected = (withCanonicalForm: boolean) =>
        new SqlColumnDefaultIR({
          resolved: { kind: 'literal', value: new Date('2024-01-02T03:04:05.000Z') },
          nativeTypeContext: 'timestamptz',
          ...(withCanonicalForm ? { toCanonicalForm: timestamptz } : {}),
        });
      const actual = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: '2024-01-02 03:04:05+00' },
        nativeTypeContext: 'timestamptz',
      });
      expect({
        withCanonicalForm: expected(true).isEqualTo(actual),
        withoutCanonicalForm: expected(false).isEqualTo(actual),
      }).toEqual({ withCanonicalForm: true, withoutCanonicalForm: false });
    });

    it('JSON literals compare canonically: object vs equivalent JSON string', () => {
      const expected = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: { a: 1, b: 2 } },
        nativeTypeContext: 'jsonb',
      });
      const actual = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: '{"b":2,"a":1}' },
        nativeTypeContext: 'jsonb',
      });
      expect(expected.isEqualTo(actual)).toBe(true);
    });

    it('false when kinds differ (literal vs function)', () => {
      const expected = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'now()' } });
      const actual = new SqlColumnDefaultIR({
        resolved: { kind: 'function', expression: 'now()' },
      });
      expect(expected.isEqualTo(actual)).toBe(false);
    });

    it('false when the expected is resolved but the actual carries only an unparseable raw', () => {
      const expected = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'x' } });
      const actual = new SqlColumnDefaultIR({ raw: 'some_unparseable_expr()' });
      expect(expected.isEqualTo(actual)).toBe(false);
    });

    it('raw-only nodes fall back to raw string equality', () => {
      const a = new SqlColumnDefaultIR({ raw: "'x'" });
      const b = new SqlColumnDefaultIR({ raw: "'x'" });
      const c = new SqlColumnDefaultIR({ raw: "'y'" });
      expect(a.isEqualTo(b)).toBe(true);
      expect(a.isEqualTo(c)).toBe(false);
    });
  });

  describe('explainMismatch (this = expected)', () => {
    const timestamptz: ToCanonicalForm = (value) => {
      if (value === '2024-01-01T00:00:00Z') return value;
      throw structuredError(
        'CONTRACT.CAST_REFUSED',
        `pg/timestamptz needs a UTC offset, but ${JSON.stringify(value)} has none.`,
      );
    };
    it('names the refusal of a contract default its data type does not hold, and says to re-emit', () => {
      const expected = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: '2024-01-01 00:00:00' },
        toCanonicalForm: timestamptz,
      });
      expect(expected.explainMismatch(undefined)).toEqual({
        text: 'The contract holds this default in a form its data type does not store: pg/timestamptz needs a UTC offset, but "2024-01-01 00:00:00" has none. Re-emit the contract, then try again.',
        cause: 'expected-refused',
      });
    });

    it('gives no explanation for a default its data type holds', () => {
      const expected = new SqlColumnDefaultIR({
        resolved: { kind: 'literal', value: '2024-01-01T00:00:00Z' },
        toCanonicalForm: timestamptz,
      });
      expect(expected.explainMismatch(undefined)).toBeUndefined();
    });

    describe('two default expressions', () => {
      function expression(text: string): SqlColumnDefaultIR {
        return new SqlColumnDefaultIR({ resolved: { kind: 'function', expression: text } });
      }

      it('names the stored form and says to write the default as the database stores it', () => {
        expect(
          expression("now() - interval '1 day'").explainMismatch(
            expression("(now() - '1 day'::interval)"),
          ),
        ).toEqual({
          text: "The database stores this default as `(now() - '1 day'::interval)`; the contract declares `now() - interval '1 day'`. The database may store a default expression in its own form, so the two can mean the same. If they do, change the default's SQL in the contract to `(now() - '1 day'::interval)`.",
          cause: 'equivalent-form',
        });
      });

      it('shows a text holding a backtick as it is', () => {
        expect(expression('"a`b"').explainMismatch(expression('("a`b")'))?.text).toBe(
          'The database stores this default as `("a`b")`; the contract declares `"a`b"`. The database may store a default expression in its own form, so the two can mean the same. If they do, change the default\'s SQL in the contract to `("a`b")`.',
        );
      });

      it('shows a multi-line text as it is', () => {
        expect(
          expression('now()').explainMismatch(expression('CASE\n  WHEN true THEN now()\nEND'))
            ?.text,
        ).toBe(
          "The database stores this default as `CASE\n  WHEN true THEN now()\nEND`; the contract declares `now()`. The database may store a default expression in its own form, so the two can mean the same. If they do, change the default's SQL in the contract to `CASE\n  WHEN true THEN now()\nEND`.",
        );
      });

      it('gives no explanation for an expression against a literal', () => {
        const actual = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'x' } });
        expect(expression('now()').explainMismatch(actual)).toBeUndefined();
      });

      it('gives no explanation for a literal against an expression', () => {
        const expected = new SqlColumnDefaultIR({ resolved: { kind: 'literal', value: 'x' } });
        expect(expected.explainMismatch(expression('now()'))).toBeUndefined();
      });

      it('gives no explanation for an expression the database lacks', () => {
        expect(expression('now()').explainMismatch(undefined)).toBeUndefined();
      });

      it('gives no explanation for an expression against an unparsed database default', () => {
        expect(
          expression('now()').explainMismatch(new SqlColumnDefaultIR({ raw: 'now()' })),
        ).toBeUndefined();
      });

      it('raises no issue for texts that differ only in case, so nothing is explained', () => {
        expect(diffSchemas(expression('now()'), expression('NOW()'))).toEqual([]);
      });
    });
  });
});
