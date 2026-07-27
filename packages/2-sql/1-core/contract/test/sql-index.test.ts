import { describe, expect, it } from 'vitest';
import {
  Index,
  type IndexInput,
  indexInputFromSerialized,
  type SerializedIndex,
} from '../src/ir/sql-index';

/**
 * Routes flat data through the serialized-load boundary — the place the
 * name/prefix pair is validated now that the constructor takes the union.
 */
function input(partial: {
  readonly name: string;
  readonly prefix?: string;
  readonly columns?: readonly string[];
  readonly expression?: string;
  readonly where?: string;
  readonly unique: boolean;
  readonly type?: string;
  readonly options?: Record<string, unknown>;
}): IndexInput {
  return indexInputFromSerialized(partial as SerializedIndex);
}

describe('Index', () => {
  it('constructs a managed column index (prefix + wire name)', () => {
    const idx = new Index(
      input({
        name: 'users_email_idx_ab12cd34',
        prefix: 'users_email_idx',
        columns: ['email'],
        unique: false,
      }),
    );
    expect(idx).toEqual({
      name: 'users_email_idx_ab12cd34',
      prefix: 'users_email_idx',
      columns: ['email'],
      unique: false,
    });
  });

  it('constructs an exact column index (no prefix)', () => {
    const idx = new Index(input({ name: 'users_email_key', columns: ['email'], unique: false }));
    expect(idx).toEqual({ name: 'users_email_key', columns: ['email'], unique: false });
  });

  it('constructs an exact expression index with a where predicate', () => {
    const idx = new Index(
      input({
        name: 'users_email_eq',
        expression: 'lower(email)',
        where: 'deleted_at IS NULL',
        unique: true,
        type: 'btree',
      }),
    );
    expect(idx).toEqual({
      name: 'users_email_eq',
      expression: 'lower(email)',
      where: 'deleted_at IS NULL',
      unique: true,
      type: 'btree',
    });
  });

  it('carries type and options through unchanged', () => {
    const idx = new Index(
      input({
        name: 'users_email_key',
        columns: ['email'],
        unique: false,
        type: 'hash',
        options: { fillfactor: 70 },
      }),
    );
    expect(idx.type).toBe('hash');
    expect(idx.options).toEqual({ fillfactor: 70 });
  });

  describe('columns xor expression (runtime backstop behind the input union)', () => {
    it('rejects both columns and expression', () => {
      expect(
        () =>
          new Index({
            naming: { kind: 'exact', name: 'users_email_eq' },
            columns: ['email'],
            expression: 'lower(email)',
            where: undefined,
            unique: false,
            type: undefined,
            options: undefined,
          } as never),
      ).toThrow(/exactly one of columns or expression/);
    });

    it('rejects neither columns nor expression', () => {
      expect(
        () =>
          new Index({
            naming: { kind: 'exact', name: 'users_email_eq' },
            where: undefined,
            unique: false,
            type: undefined,
            options: undefined,
          } as never),
      ).toThrow(/exactly one of columns or expression/);
    });
  });

  describe('name is always the full physical name', () => {
    it('rejects a missing name at runtime (unvalidated JSON input)', () => {
      const raw: unknown = { columns: ['email'], unique: false };
      expect(() => new Index(indexInputFromSerialized(raw as never))).toThrow(/full physical name/);
    });
  });

  describe('prefix implies the name is that prefix plus a wire hash', () => {
    it('accepts prefix when the name is formatWireName(prefix, hash)', () => {
      const idx = new Index(
        input({
          name: 'users_email_idx_deadbeef',
          prefix: 'users_email_idx',
          columns: ['email'],
          unique: false,
        }),
      );
      expect(idx.prefix).toBe('users_email_idx');
    });

    it('rejects prefix when the name has no wire-hash suffix', () => {
      expect(
        () =>
          new Index(
            input({
              name: 'users_email_idx',
              prefix: 'users_email_idx',
              columns: ['email'],
              unique: false,
            }),
          ),
      ).toThrow(/does not match/);
    });

    it('rejects prefix when the name parses to a different prefix', () => {
      expect(
        () =>
          new Index(
            input({
              name: 'other_prefix_deadbeef',
              prefix: 'users_email_idx',
              columns: ['email'],
              unique: false,
            }),
          ),
      ).toThrow(/does not match/);
    });

    it('allows an exact name that happens to parse as a wire name (no prefix claimed)', () => {
      const idx = new Index(
        input({
          name: 'adopted_live_name_deadbeef',
          columns: ['email'],
          unique: false,
        }),
      );
      expect(idx.prefix).toBeUndefined();
    });
  });
});
